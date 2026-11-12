"""QA only. Normalized finite uniform streak convolved with a square pixel box.

Independent reference: Python libm erf + positive composite 16-point GL, refined
twice and checked against the closed-form axis-aligned integral. No runtime edits,
GPU/CFD claim, source gain or unnormalised density multiplier.
"""
import json
import math
import struct
from pathlib import Path

SQRT2=math.sqrt(2.0)
GLX=(.09501250983763744,.2816035507792589,.4580167776572274,.6178762444026438,
     .755404408355003,.8656312023878318,.9445750230732326,.9894009349916499)
GLW=(.1894506104550685,.1826034150449236,.16915651939500254,.14959598881657673,
     .12462897125553387,.09515851168249278,.06225352393864789,.027152459411754095)
def f32(x):return struct.unpack('<f',struct.pack('<f',x))[0]

def shader_erf(x):
    if x==0: return 0.0
    sign=-1 if x<0 else 1
    x=abs(x)
    t=1/(1+.3275911*x)
    return sign*(1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*math.exp(-x*x))

def box_gaussian(p,sigma,erf=math.erf):
    v=1/(sigma*SQRT2)
    return max(0.0,.25*(erf((p[0]+.5)*v)-erf((p[0]-.5)*v))*(erf((p[1]+.5)*v)-erf((p[1]-.5)*v)))

def reference(p,m,sigma,refine=1):
    length=math.hypot(*m)
    if length==0: return box_gaussian(p,sigma)
    panels=max(1,math.ceil(length/(4*sigma)))*refine
    total=0.0
    half=.5/panels
    for i in range(panels):
        mid=(i+.5)/panels-.5
        for x,w in zip(GLX,GLW):
            for t in (mid-half*x,mid+half*x):
                total+=w*half*box_gaussian((p[0]-m[0]*t,p[1]-m[1]*t),sigma)
    return total

def axis_reference(p,length,sigma):
    if length==0:return box_gaussian(p,sigma)
    def f(x):
        z=x/sigma
        return .5*x*(1+math.erf(z/SQRT2))+sigma/math.sqrt(2*math.pi)*math.exp(-.5*z*z)
    x=p[0]
    integral=(f(x+.5+length*.5)-f(x+.5-length*.5)-f(x-.5+length*.5)+f(x-.5-length*.5))/length
    return max(0,integral)*.5*(math.erf((p[1]+.5)/(sigma*SQRT2))-math.erf((p[1]-.5)/(sigma*SQRT2)))

def mix_spec(length,sigma=.28):
    target_step=.5*max(1.,sigma)
    x=max(7.,length/target_step)
    n0=math.floor(x)+1
    f=x-math.floor(x)
    w=max(0.,min(1.,f*f*f*(f*(6*f-15)+10)))
    return n0,n0+1,w

def midpoint(p,m,sigma,n,erf=math.erf,local=False,shutter=(0.,0.)):
    length=math.hypot(*m)
    axis=(m[0]/length,m[1]/length) if length else (1.,0.)
    halfbox=.5*(abs(axis[0])+abs(axis[1]))
    support=halfbox+6*sigma+.02+.38729833462*abs(shutter[0]*axis[0]+shutter[1]*axis[1])
    total=0.0
    for i in range(n):
        t=(i+.5)/n-.5
        q=(p[0]-m[0]*t,p[1]-m[1]*t)
        if local and abs(q[0]*axis[0]+q[1]*axis[1])>support:continue
        if shutter==(0.,0.): value=box_gaussian(q,sigma,erf)
        else:
            shift=(shutter[0]*.38729833462,shutter[1]*.38729833462)
            value=box_gaussian(q,sigma,erf)*(4/9)+(box_gaussian((q[0]-shift[0],q[1]-shift[1]),sigma,erf)+box_gaussian((q[0]+shift[0],q[1]+shift[1]),sigma,erf))*(5/18)
        total+=value/n
    return total

def candidate(p,m,sigma,erf=math.erf,local=False,shutter=(0.,0.)):
    n0,n1,w=mix_spec(math.hypot(*m),sigma)
    return (1-w)*midpoint(p,m,sigma,n0,erf,local,shutter)+w*midpoint(p,m,sigma,n1,erf,local,shutter)

def continuous_points(length,angle,phase):
    a=(math.cos(angle),math.sin(angle))
    locations=(-length*.5-1,-length*.5,-length*.5+.4,-length*.25,0,.123*length,length*.25,length*.5-.4,length*.5,length*.5+1)
    points=[]
    for s in locations:
        p=(round(a[0]*s+phase[0])-phase[0],round(a[1]*s+phase[1])-phase[1])
        if p not in points:points.append(p)
    return points

def main():
    checks=[]
    def check(name,ok,**evidence):checks.append(dict(name=name,passed=bool(ok),**evidence))
    max_erf=max(abs(shader_erf(-8+i*.0016)-math.erf(-8+i*.0016)) for i in range(10001))
    check('shader_erf_approx_error_is_recorded_separately',max_erf<1.6e-7,maximumAbsoluteError=max_erf,domain=[-8,8],samples=10001)
    cases=[];fixtures=[];max_ref_error=0.;max_axis_error=0.;max_local_error=0.;max_approx_error=0.;max_point_excess=0.
    for length in (0.,4.,17.,30.):
      for sigma in (.28,.55,1.,4.,20.):
       for degree in (0.,22.5,45.):
        angle=math.radians(degree);m=(length*math.cos(angle),length*math.sin(angle));peak_scale=box_gaussian((0.,0.),sigma) if length==0 else 1/length
        legacy_error=0.;spatial_error=0.;approx_error=0.;local_error=0.;maximum_ratio=0.;worst=None;point_count=0
        for phase in ((0.,0.),(.37,.23)):
         for p in continuous_points(length,angle,phase):
            ref=reference(p,m,sigma);ref_fine=reference(p,m,sigma,2);ref_delta=abs(ref-ref_fine);max_ref_error=max(max_ref_error,ref_delta)
            if degree==0:max_axis_error=max(max_axis_error,abs(axis_reference(p,length,sigma)-ref_fine))
            old=midpoint(p,m,sigma,8);a=candidate(p,m,sigma);b=candidate(p,m,sigma,shader_erf);local=candidate(p,m,sigma,math.erf,True)
            e=abs(a-ref_fine);legacy_error=max(legacy_error,abs(old-ref_fine));spatial_error=max(spatial_error,e);approx_error=max(approx_error,abs(a-b));local_error=max(local_error,abs(local-a));point_count+=1
            ratio=e/max(peak_scale,1e-30)
            if ratio>maximum_ratio:maximum_ratio=ratio;worst=dict(pixelOffset=p,reference=ref_fine,candidate=a,legacy8=old,error=e,normalizationPeakScale=peak_scale)
            max_point_excess=max(max_point_excess,a-min(1.,1/(2*math.pi*sigma*sigma)))
            if length in (17.,30.) and sigma==.28 and len(fixtures)<256:
                fp=tuple(map(f32,p));fm=tuple(map(f32,m));fs=f32(sigma)
                fixtures.append(dict(pixelOffset=fp,motion=fm,sigma=fs,inputRounding='explicitFloat32beforeallreferencecalls',expected=reference(fp,fm,fs,2),candidateExactErf=candidate(fp,fm,fs),candidateShaderErf=candidate(fp,fm,fs,shader_erf),candidateLocalShaderErf=candidate(fp,fm,fs,shader_erf,True),legacy8ShaderErf=midpoint(fp,fm,fs,8,shader_erf),refinementDifference=abs(reference(fp,fm,fs)-reference(fp,fm,fs,2))))
        max_local_error=max(max_local_error,local_error);max_approx_error=max(max_approx_error,approx_error)
        n0,n1,w=mix_spec(length,sigma);cases.append(dict(lengthPixels=length,sigma=sigma,angleDegrees=degree,phases=2,points=point_count,N0=n0,N1=n1,mix=w,legacy8MaximumAbsoluteError=legacy_error,candidateSpatialMaximumAbsoluteError=spatial_error,spatialErrorOverPeakScale=maximum_ratio,shaderErfOnlyMaximumAbsoluteError=approx_error,localWindowOnlyMaximumAbsoluteError=local_error,worst=worst))
    check('independent_GL16_refinement_converges',max_ref_error<2e-12,maximumAbsoluteDifference=max_ref_error)
    check('axis_closed_form_agrees_with_numerical_reference',max_axis_error<2e-12,maximumAbsoluteDifference=max_axis_error)
    q6=.5*math.erfc(6/SQRT2)
    check('local_support_drops_at_most_Q6_per_pixel_without_renormalising',max_local_error<=q6+2e-14,maximumObservedAbsoluteDifference=max_local_error,oneSidedProbabilityBound=q6,wholePlaneMassBound=2*q6,scope='exact erf; excludes approximate erf, floating arithmetic and finite quad clipping')
    check('positive_normalized_spatial_averages_preserve_original_point_peak_bound',max_point_excess<2e-14,maximumExcess=max_point_excess,mathematicalReason='convex combinations of pixel-box Gaussian; Gaussian peak times pixel area and total probability each bound the pixel integral')
    check('approx_erf_error_not_conflated_with_spatial_quadrature',max_approx_error<=4*max_erf+2e-14,maximumObservedError=max_approx_error,conservativeAbsoluteBound=4*max_erf+2e-14)
    normalization=[];transition=[]
    for length in (0.,3.5,4.,8.13,17.,30.,30.37):
        n0,n1,w=mix_spec(length);weight=(1-w)*sum(1/n0 for _ in range(n0))+w*sum(1/n1 for _ in range(n1));normalization.append(dict(length=length,N0=n0,N1=n1,mix=w,weightSum=weight))
    check('spatial_kernel_infinite_plane_flux_is_one',all(abs(x['weightSum']-1)<2e-14 for x in normalization),samples=normalization,reason='each pixel-box Gaussian tiles to unit flux over all pixels; all temporal/spatial weights remain positive and normalized')
    for k in (7,8,17,34,60):
        l=k/2;epsilon=1e-6;angle=math.pi/8;p=(.13,.23);left=((l-epsilon)*math.cos(angle),(l-epsilon)*math.sin(angle));right=((l+epsilon)*math.cos(angle),(l+epsilon)*math.sin(angle));ca=candidate(p,left,.28);cb=candidate(p,right,.28);ra=reference(p,left,.28,2);rb=reference(p,right,.28,2);transition.append(dict(length=l,leftN=mix_spec(l-epsilon),rightN=mix_spec(l+epsilon),candidateDifference=cb-ca,referencePhysicalDifference=rb-ra,excessDifference=(cb-ca)-(rb-ra)))
    check('quintic_N_transition_has_no_finite_kernel_jump',all(abs(x['excessDifference'])<1e-7 for x in transition),epsilonPixels=1e-6,transitions=transition,scope='interior adaptive branch only; global/local resource fallback boundaries are separate')
    sigma_boundary=[]
    for length in (17.,17.23,30.37):
        angle=math.pi/8;m=(length*math.cos(angle),length*math.sin(angle));p=(.13,.23)
        for epsilon in (1e-6,.001):
            sa=1-epsilon;sb=1+epsilon;ca=candidate(p,m,sa);cb=candidate(p,m,sb);ra=reference(p,m,sa,2);rb=reference(p,m,sb,2)
            sigma_boundary.append(dict(length=length,sigmaLeft=sa,sigmaRight=sb,Nleft=mix_spec(length,sa),Nright=mix_spec(length,sb),candidateDifference=cb-ca,physicalDifference=rb-ra,excessDifference=(cb-ca)-(rb-ra)))
    check('sigma_one_policy_is_continuous_including_0999_1001',all(abs(x['excessDifference'])<1e-7 for x in sigma_boundary if x['sigmaLeft']>.999),samples=sigma_boundary,scope='C0 no finite jump; max(1,sigma) is not claimed C1 for every fractionalN')
    budgets=[]
    for length in (0.,4.,17.,30.,1000.,100000.):
      for sigma in (.28,1.,4.,20.,1000.):
        n0,n1,w=mix_spec(length,sigma);half=.5*math.sqrt(2)+6*sigma+.02
        if length==0:used=n0+n1
        else:used=min(n0,math.ceil(2*half*n0/length)+2)+min(n1,math.ceil(2*half*n1/length)+2)
        global_fallback=n1>65536
        budgets.append(dict(length=length,sigma=sigma,N0=n0,N1=n1,conservativeCombinedLocalCalls=used,wholeSourceGlobalFallback=global_fallback,localFallback=used>256))
    check('sigma_scaled_step_keeps_tested_broadPSF_local_budget_bounded',all(x['conservativeCombinedLocalCalls']<=256 for x in budgets if not x['wholeSourceGlobalFallback']),samples=budgets,scope='source-only local call estimate without explicit shutter; MAX_LOCAL128 perlevel; fallback still requires production vertex/shader checks')
    actual=[x for x in cases if x['lengthPixels'] in (17.,30.) and x['sigma']==.28]
    ripple=[]
    for length in (17.,30.):
      for degree in (0.,22.5,45.):
        a=(math.cos(math.radians(degree)),math.sin(math.radians(degree)));m=(length*a[0],length*a[1]);values=[]
        for i in range(129):
            s=length*(i/128-.5)*.5;p=(a[0]*s-a[1]*.13,a[1]*s+a[0]*.13);r=reference(p,m,.28)
            values.append((r,midpoint(p,m,.28,8)-r,candidate(p,m,.28)-r))
        mean=sum(v[0] for v in values)/len(values)
        ripple.append(dict(lengthPixels=length,angleDegrees=degree,profileSamples=129,scope='continuous along-axis image function at fixed transverse offset; not a GPU raster simulation',legacy8PeakToPeakErrorOverReferenceMean=(max(v[1] for v in values)-min(v[1] for v in values))/mean,candidatePeakToPeakErrorOverReferenceMean=(max(v[2] for v in values)-min(v[2] for v in values))/mean))
    result=dict(schema='glass-atoll.uniform-gaussian-streak-independent-oracle.v1',passed=all(c['passed'] for c in checks),counts=dict(passed=sum(c['passed'] for c in checks),total=len(checks)),checks=checks,candidateContract=dict(pixelSigmaFloor=.28,interval=[-.5,.5],N='targetStep=.5*max(1,sigma);x=max(7,L/targetStep);N0=floor(x)+1;N1=N0+1;clampedQuintic(fract(x))',pointSpacing='less than .5*max(1,sigma) pixels',localSupport='boxProjectionHalf+6sigma+.02+explicitShutterProjection',localNormalization='keep global1/N denominator'),cases=cases,actualLengthSummary=dict(maximumLegacy8Error=max(x['legacy8MaximumAbsoluteError'] for x in actual),maximumCandidateSpatialError=max(x['candidateSpatialMaximumAbsoluteError'] for x in actual),maximumCandidateErrorOverPeakScale=max(x['spatialErrorOverPeakScale'] for x in actual)),interiorRipple=ripple,fixtures=fixtures,actualGPU=False,productionEdited=False,limits=['No GPU Float32/driver/F16/exposure/visual or performance acceptance. Python libm double erf, not production erfApprox, supplies the independent reference.','Full-plane normalized flux is a kernel identity, not exact finite-quad/raster/MSAA flux. Existing quad clipping and real main/mirror cost still need actual GPU tests.','Local6sigma error bound excludes approximate-erf and Float32 cancellation. Positive weights preserve the existing pointbound; near-plane projection and overlap-bin correctness are outside this isolated2D kernel test.','MAX_LOCAL/MAX_GLOBAL fallback must be whole-source and explicitly reported; switching tolegacy8 at resource limits may change shape and is not covered by interiorN continuity.','A uniform finite emitter-segment model is an image-space exposure surrogate, not a measured star plasma geometry or added physical source.'])
    output=Path(__file__).with_suffix('.json');output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+'\n',encoding='utf-8');print(json.dumps(dict(passed=result['passed'],counts=result['counts'],actualLengthSummary=result['actualLengthSummary'],worstRefinement=max_ref_error,maximumAxisDifference=max_axis_error),indent=2))
    if not result['passed']:raise SystemExit(1)

if __name__=='__main__':main()
