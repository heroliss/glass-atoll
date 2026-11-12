#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
uniform highp sampler2D tInput;
uniform float uNitsToLinear;
uniform int uEncodeSRGB;
in vec2 vUv;
out vec4 colour;

// QA_ACCURATE_ATAN2_BEGIN: non-official arithmetic substitution, no colour tuning.
float qaAccurateAtan2(float y, float x)
{
    uint xb = floatBitsToUint(x), yb = floatBitsToUint(y);
    uint ax = xb & 0x7fffffffu, ay = yb & 0x7fffffffu;
    bool sx = (xb & 0x80000000u) != 0u, sy = (yb & 0x80000000u) != 0u;
    if (ax > 0x7f800000u || ay > 0x7f800000u) return uintBitsToFloat(0x7fc00000u);
    float a;
    if (ay == 0u) a = 0.0;
    else if (ax == 0u) a = 1.57079632679489661923;
    else if (ax == 0x7f800000u || ay == 0x7f800000u)
        a = ax == ay ? 0.78539816339744830962 : (ay == 0x7f800000u ? 1.57079632679489661923 : 0.0);
    else
    {
        uint hi = max(ax, ay), lo = min(ax, ay);
        float r;
        // Integer mantissas preserve ratios when both finite inputs are subnormal.
        // Mixed subnormal/normal scaling avoids dividing an FTZ operand directly.
        if (hi < 0x00800000u) r = float(lo) / float(hi);
        else if (lo < 0x00800000u)
            r = (float(lo) / float((hi & 0x007fffffu) | 0x00800000u)) * exp2(1.0 - float(hi >> 23u));
        else r = uintBitsToFloat(lo) / uintBitsToFloat(hi);
        bool reduce = r > 0.41421356237309504880;
        float z = reduce ? (r - 1.0) / (r + 1.0) : r;
        float z2 = z * z;
        float p = 1.0 / 17.0;
        p = -1.0 / 15.0 + z2 * p;
        p = 1.0 / 13.0 + z2 * p;
        p = -1.0 / 11.0 + z2 * p;
        p = 1.0 / 9.0 + z2 * p;
        p = -1.0 / 7.0 + z2 * p;
        p = 1.0 / 5.0 + z2 * p;
        p = -1.0 / 3.0 + z2 * p;
        a = z * (1.0 + z2 * p);
        if (reduce) a += 0.78539816339744830962;
        if (ay > ax) a = 1.57079632679489661923 - a;
    }
    if (sx) a = 3.14159265358979323846 - a;
    // Explicit signed zero, independent of compiler unary-minus folding.
    return uintBitsToFloat(floatBitsToUint(a) | (sy ? 0x80000000u : 0u));
}
// QA_ACCURATE_ATAN2_END


// Declaration of all textures

uniform sampler2D aces2_1200_reach_m_table_0Sampler;
uniform sampler2D aces2_1200_gamut_cusp_table_0Sampler;

// Declaration of all helper methods

float aces2_1200_reach_m_table_0_sample(float h)
{
  float i_base = floor(h);
  float i_lo = i_base + float(1);
  float i_hi = i_lo + 1.0;
  float lo = texture(aces2_1200_reach_m_table_0Sampler, vec2((i_lo + 0.5) / float (363), 0.0)).r;
  float hi = texture(aces2_1200_reach_m_table_0Sampler, vec2((i_hi + 0.5) / float (363), 0.5)).r;
  float t = h - i_base;
  return mix(lo, hi, t);
}
float aces2_1200_tonescale_fwd0(float J)
{
  float A = 0.0323680267 * pow(abs(J) * 0.00999999978, 0.879464149);
  float Y = pow(( 27.1299992 * A) / (1.0f - A), 2.3809523809523809);
  float f = 12.2142391 * pow(Y / (Y + 5.4166217621155965), 1.14999998);
  float Y_ts = max(0.0, f * f / (f + 0.0399999991));
  float F_L_Y = pow(0.79370057210326195 * Y_ts, 0.42);
  float J_ts = 100. * pow((F_L_Y / ( 27.1299992 + F_L_Y)) * 30.8946857, 1.13705599);
  return sign(J) * J_ts;
}
float aces2_1200_toe_fwd0(float x, float limit, float k1_in, float k2_in)
{
  float k2 = max(k2_in, 0.001);
  float k1 = sqrt(k1_in * k1_in + k2 * k2);
  float k3 = (limit + k1) / (limit + k2);
  return (x > limit) ? x : 0.5 * (k3 * x - k1 + sqrt((k3 * x - k1) * (k3 * x - k1) + 4.0 * k2 * k3 * x));
}
const float aces2_1200_gamut_cusp_table_0_hues_array[363] = float[363](-1.00241089, 0., 1.00149214, 2.00298429, 3.00447655, 4.00596857, 5.00746059, 6.00895309, 7.01044512, 8.01193714, 9.01342964, 10.0149212, 11.0164137, 12.0179062, 13.0193977, 14.0208902, 15.0223818, 16.0238743, 17.0253658, 18.0268593, 19.0283508, 20.0298424, 21.0313358, 22.0328274, 23.0343189, 24.0358124, 25.0373039, 26.0387955, 26.6960354, 27.7042446, 28.7124538, 29.7206631, 30.7288742, 31.7370834, 32.7452927, 33.7535019, 34.7617111, 35.7699203, 36.7781296, 37.7863388, 38.794548, 39.8027573, 40.8109665, 41.8191757, 42.8273849, 43.8355942, 44.8438034, 45.8520126, 46.8602219, 47.8684349, 48.8766441, 49.8848534, 50.8930626, 51.9012718, 52.909481, 53.9176903, 54.9259033, 55.9341125, 56.9423218, 57.950531, 58.9587402, 59.9669495, 60.9751587, 61.9833679, 62.9915771, 63.9997864, 65.0079956, 66.0162048, 67.0244141, 68.0326233, 69.0408325, 70.0490417, 71.057251, 72.0654602, 73.0736694, 74.0818787, 75.0900879, 76.0982971, 77.1065063, 78.1147156, 79.1229248, 80.131134, 81.1393433, 82.1475525, 83.1557693, 84.1639786, 85.1721878, 86.180397, 87.1886063, 88.1968155, 89.2050247, 90.2132339, 91.2214432, 92.2296524, 93.2378616, 94.2460709, 95.2542801, 96.2624893, 97.2706985, 98.2789078, 99.287117, 100.295326, 101.303535, 102.311745, 103.319954, 104.328163, 105.336372, 106.344589, 106.700523, 107.70636, 108.712189, 109.718025, 110.723854, 111.729691, 112.735519, 113.741356, 114.747192, 115.753021, 116.758858, 117.764687, 118.770523, 119.776352, 120.782188, 121.788025, 122.793854, 123.79969, 124.805527, 125.811356, 126.817184, 127.823021, 128.828857, 129.834686, 130.840515, 131.846359, 132.852188, 133.858017, 134.863861, 135.86969, 136.875519, 137.881348, 138.887192, 139.893021, 140.984863, 142.076691, 143.168518, 144.260361, 145.352203, 146.444031, 147.437683, 148.431351, 149.425003, 150.418655, 151.412323, 152.405975, 153.399628, 154.39328, 155.386948, 156.3806, 157.374252, 158.36792, 159.361572, 160.355225, 161.348892, 162.342545, 163.336197, 164.329865, 165.323517, 166.317169, 167.310822, 168.304489, 169.298141, 170.291794, 171.285461, 172.279114, 173.272766, 174.266418, 175.260086, 176.253738, 177.247406, 178.241058, 179.234711, 180.228363, 181.222031, 182.215683, 183.209335, 184.203003, 185.196655, 186.190308, 187.18396, 188.177628, 189.17128, 190.164948, 191.1586, 192.152252, 193.054413, 193.956573, 194.858749, 195.76091, 196.760483, 197.760071, 198.759644, 199.759216, 200.758789, 201.758377, 202.75795, 203.757523, 204.757111, 205.756683, 206.756256, 207.755844, 208.755417, 209.75499, 210.754562, 211.75415, 212.753723, 213.753296, 214.752884, 215.752457, 216.752029, 217.751617, 218.75119, 219.750763, 220.750336, 221.749924, 222.749496, 223.749069, 224.748657, 225.74823, 226.747803, 227.747375, 228.746964, 229.746536, 230.746124, 231.745697, 232.74527, 233.744843, 234.744415, 235.744003, 236.743576, 237.743164, 238.742737, 239.74231, 240.741882, 241.74147, 242.741043, 243.740616, 244.740204, 245.739777, 246.739349, 247.738922, 248.73851, 249.738083, 250.737656, 251.737244, 252.736816, 253.736389, 254.735962, 255.73555, 256.735107, 257.734711, 258.734283, 259.733856, 260.733429, 261.733002, 262.732605, 263.732178, 264.73175, 265.731323, 266.730896, 267.739899, 268.748901, 269.757935, 270.766937, 271.77594, 272.784943, 273.793976, 274.802979, 275.811981, 276.81366, 277.815338, 278.816986, 279.818665, 280.820343, 281.822021, 282.8237, 283.825348, 284.827026, 285.828705, 286.830383, 287.832031, 288.83371, 289.835388, 290.837067, 291.838745, 292.840393, 293.842072, 294.84375, 295.845428, 296.847107, 297.848755, 298.850433, 299.852112, 300.85379, 301.855469, 302.857117, 303.858795, 304.860474, 305.862152, 306.8638, 307.865479, 308.867157, 309.868835, 310.870514, 311.872162, 312.87384, 313.875519, 314.877197, 315.878845, 316.880524, 317.882202, 318.883881, 319.885559, 320.887207, 321.888885, 322.890564, 323.892242, 324.893921, 325.895569, 326.897247, 327.898926, 328.900604, 329.902283, 330.903931, 331.905609, 332.907288, 333.912781, 334.918274, 335.923767, 336.92926, 337.934753, 338.940247, 339.94574, 340.951233, 341.956726, 342.959137, 343.961548, 344.963928, 345.966339, 346.96875, 347.971161, 348.973541, 349.975952, 350.978363, 351.980774, 352.983185, 353.985565, 354.987976, 355.990387, 356.992798, 357.995178, 358.997589, 360., 361.001495);
vec3 aces2_1200_gamut_cusp_table_0_sample(float h)
{
  int i = int(h) + 1;
  int i_lo = int(max(float(0), float(i + 0)));
  int i_hi = int(min(float(361), float(i + 2)));
  while (i_lo + 1 < i_hi)
  {
    float hcur = aces2_1200_gamut_cusp_table_0_hues_array[i];
    if (h > hcur)
    {
      i_lo = i;
    }
    else
    {
      i_hi = i;
    }
    i = (i_lo + i_hi) / 2;
  }
  vec3 lo = texture(aces2_1200_gamut_cusp_table_0Sampler, vec2((float(i_hi) - 1.0 + 0.5) / float(363), 0.5)).rgb;
  vec3 hi = texture(aces2_1200_gamut_cusp_table_0Sampler, vec2((float(i_hi) + 0.5) / float(363), 0.5)).rgb;
  float t = (h - aces2_1200_gamut_cusp_table_0_hues_array[i_hi - 1]) / (aces2_1200_gamut_cusp_table_0_hues_array[i_hi] - aces2_1200_gamut_cusp_table_0_hues_array[i_hi - 1]);
  return mix(lo, hi, t);
}
float aces2_1200_get_focus_gain0(float J, float cuspJ)
{
  float thr = mix(cuspJ, 306.772125, 0.300000);
  if (J > thr)
  {
    float gain = ( 306.772125 - thr) / max(0.0001, 306.772125 - J);
    gain = log(gain)/log(10.0);
    return gain * gain + 1.0;
  }
  else
  {
    return 1.0;
  }
}
float aces2_1200_solve_J_intersect0(float J, float M, float focusJ, float slope_gain)
{
  float M_scaled = M / slope_gain;
  float a = M_scaled / focusJ;
  if (J < focusJ)
  {
    float b = 1.0 - M_scaled;
    float c = -J;
    float det =  b * b - 4.f * a * c;
    float root =  sqrt(det);
    return -2.0 * c / (b + root);
  }
  else
  {
    float b = - (1.0 + M_scaled + 306.772125 * a);
    float c = 306.772125 * M_scaled + J;
    float det =  b * b - 4.f * a * c;
    float root =  sqrt(det);
    return -2.0 * c / (b - root);
  }
}
float aces2_1200_find_gamut_boundary_intersection0(vec2 JM_cusp, float gamma_top_inv, float gamma_bottom_inv, float J_intersect_source, float J_intersect_cusp, float slope)
{
  float M_boundary_lower = J_intersect_cusp * pow(J_intersect_source / J_intersect_cusp, gamma_bottom_inv) / (JM_cusp.r / JM_cusp.g - slope);
  float M_boundary_upper = JM_cusp.g * (306.772125 - J_intersect_cusp) * pow((306.772125 - J_intersect_source) / (306.772125 - J_intersect_cusp), gamma_top_inv) / (slope * JM_cusp.g + 306.772125 - JM_cusp.r);
  float smin = 0.0;
  {
    float a = M_boundary_lower;
    float b = M_boundary_upper;
    float s = 0.119999997 * JM_cusp.g;
    float h = max(s - abs(a - b), 0.0) / s;
    smin = min(a, b) - h * h * h * s * 0.16666666666666666;
  }
  return smin;
}
float aces2_1200_remap_M_fwd0(float M, float gamut_boundary_M, float reach_boundary_M)
{
  float boundary_ratio = gamut_boundary_M / reach_boundary_M;
  float proportion = max(boundary_ratio, 0.75);
  float threshold = proportion * gamut_boundary_M;
  if (proportion >= 1.0f || M <= threshold)
  {
    return M;
  }
  float m_offset = M - threshold;
  float gamut_offset = gamut_boundary_M - threshold;
  float reach_offset = reach_boundary_M - threshold;
  float scale = reach_offset / ((reach_offset / gamut_offset) - 1.0f);
  float nd = m_offset / scale;
  return threshold + scale * nd / (1.0f + nd);
}
vec3 aces2_1200_gamut_compress0(vec3 JMh, float Jx, vec3 JMGcusp, float reachMaxM)
{
  float J = JMh.r;
  float M = JMh.g;
  float h = JMh.b;
  if (M <= 0.0 || J > 306.772125)
  {
    return vec3(J, 0.0, h);
  }
  else
  {
    vec2 JMcusp = JMGcusp.rg;
    float focusJ = mix(JMcusp.r, 41.296421, min(1.0, 1.300000 - (JMcusp.r / 306.772125)));
    float slope_gain = 1196.27808 * aces2_1200_get_focus_gain0(Jx, JMcusp.r);
    float J_intersect_source = aces2_1200_solve_J_intersect0(JMh.r, JMh.g, focusJ, slope_gain);
    float gamut_slope = (J_intersect_source < focusJ) ? J_intersect_source : (306.772125 - J_intersect_source);
    gamut_slope = gamut_slope * (J_intersect_source - focusJ) / (focusJ * slope_gain);
    float gamma_top_inv = JMGcusp.b;
    float gamma_bottom_inv = 0.822677851;
    float J_intersect_cusp = aces2_1200_solve_J_intersect0(JMcusp.r, JMcusp.g, focusJ, slope_gain);
    float gamutBoundaryM = aces2_1200_find_gamut_boundary_intersection0(JMcusp, gamma_top_inv, gamma_bottom_inv, J_intersect_source, J_intersect_cusp, gamut_slope);
    if (gamutBoundaryM <= 0.0)
    {
      return vec3(J, 0.0, h);
    }
    float reachBoundaryM = 306.772125 * pow(J_intersect_source / 306.772125,  0.879464149);
    reachBoundaryM = reachBoundaryM / ((306.772125 / reachMaxM) - gamut_slope);
    float remapped_M = aces2_1200_remap_M_fwd0(M, gamutBoundaryM, reachBoundaryM);
    float remapped_J = J_intersect_source + remapped_M * gamut_slope;
    return vec3(remapped_J, remapped_M, h);
  }
}

// Declaration of the OCIO shader function

vec4 aces2Display1200(vec4 inPixel)
{
  vec4 outColor = inPixel;
  
  // Add Matrix processing
  
  {
    vec4 res = vec4(outColor.rgb.r, outColor.rgb.g, outColor.rgb.b, outColor.a);
    vec4 tmp = res;
    res = mat4(0.61309740240118782, 0.070193722469581873, 0.020615592882226925, 0., 0.3395231461841059, 0.91635387905734356, 0.10956977293813538, 0., 0.047379451414706591, 0.013452398473074128, 0.86981463417963734, 0., 0., 0., 0., 1.) * tmp;
    outColor.rgb = vec3(res.x, res.y, res.z);
    outColor.a = res.w;
  }
  
  // Add Range processing
  
  {
    outColor.rgb = max(vec3(0., 0., 0.), outColor.rgb);
    outColor.rgb = min(vec3(4339.24462890625, 4339.24462890625, 4339.24462890625), outColor.rgb);
  }
  
  // Add Matrix processing
  
  {
    vec4 res = vec4(outColor.rgb.r, outColor.rgb.g, outColor.rgb.b, outColor.a);
    vec4 tmp = res;
    res = mat4(0.69545224135745187, 0.044794563372037716, -0.0055258825581135443, 0., 0.14067869647029416, 0.85967111845642163, 0.0040252103059786595, 0., 0.16386906217225405, 0.0955343181715404, 1.0015006722521349, 0., 0., 0., 0., 1.) * tmp;
    outColor.rgb = vec3(res.x, res.y, res.z);
    outColor.a = res.w;
  }
  
  // Add FixedFunction 'ACES_OutputTransform20 (Forward)' processing
  
  {
    
    // Add RGB to JMh
    
    vec3 JMh;
    vec3 Aab;
    {
      {
        vec3 lms = mat3(0.445181042, 0.123734146, 0.0117007261, 0.34964928, 0.613643706, 0.0280607939, -0.00112973212, 0.0563228019, 0.753939033) * outColor.rgb;
        vec3 F_L_v = pow(abs(lms), vec3(0.419999987, 0.419999987, 0.419999987));
        vec3 rgb_a = (sign(lms) * F_L_v) / ( 27.1299992 + F_L_v);
        Aab = mat3(20.25881, 15480., 1720., 10.129405, -16887.2734, 1720., 0.506470263, 1407.27271, -3440.) * rgb_a.rgb;
      }
      {
        if (Aab.r <= 0.0)
        {
          JMh.rgb = vec3(0., 0., 0.);
        }
        else
        {
          float J = 100. * pow(Aab.r, 1.13705599);
          float M = (J == 0.0) ? 0.0 : sqrt(Aab.g * Aab.g + Aab.b * Aab.b);
          float h = (Aab.g == 0.0) ? 0.0 : qaAccurateAtan2(Aab.b, Aab.g) * 57.29577951308238;
          h = h - floor(h / 360.0) * 360.0;
          h = (h < 0.0) ? h + 360.0 : h;
          JMh.rgb = vec3(J, M, h);
        }
      }
      outColor.rgb = JMh;
    }
    float h_rad = outColor.b * 0.0174532924;
    float cos_hr = cos(h_rad);
    float sin_hr = sin(h_rad);
    
    // Add ToneScale and ChromaCompress (fwd)
    
    float J_ts = aces2_1200_tonescale_fwd0(outColor.r);
    // Sample tables (fwd)
    float reachMaxM = aces2_1200_reach_m_table_0_sample(outColor.b);
    
    {
      float J = outColor.r;
      float M = outColor.g;
      float h = outColor.b;
      float M_cp = M;
      if (M != 0.0)
      {
        float nJ = J_ts / 306.772125;
        float snJ = max(0.0, 1.0 - nJ);
        float Mnorm;
        {
          float cos_hr2 = 2.0 * cos_hr * cos_hr - 1.0;
          float sin_hr2 = 2.0 * cos_hr * sin_hr;
          float cos_hr3 = 4.0 * cos_hr * cos_hr * cos_hr - 3.0 * cos_hr;
          float sin_hr3 = 3.0 * sin_hr - 4.0 * sin_hr * sin_hr * sin_hr;
          vec3 cosines = vec3(cos_hr, cos_hr2, cos_hr3);
          vec3 cosine_weights = vec3(30.087226197853088, 43.692660376076702, 20.9159271985054);
          vec3 sines = vec3(sin_hr, sin_hr2, sin_hr3);
          vec3 sine_weights = vec3(38.905062529368401, -16.905719060783387, 24.390966910533905);
          Mnorm = dot(cosines, cosine_weights) + dot(sines, sine_weights) + 204.62514425231936;
        }
        float limit = pow(nJ, 0.879464149) * reachMaxM / Mnorm;
        M_cp = M * pow(J_ts / J, 0.879464149);
        M_cp = M_cp / Mnorm;
        M_cp = limit - aces2_1200_toe_fwd0(limit - M_cp, limit - 0.001, snJ * 0.331974447, sqrt(nJ * nJ + 0.000416666677));
        M_cp = aces2_1200_toe_fwd0(M_cp, limit, nJ * 10.9471149, snJ);
        M_cp = M_cp * Mnorm;
      }
      outColor.rgb = vec3(J_ts, M_cp, h);
    }
    
    // Add GamutCompress (fwd)
    
    {
      vec3 JMGcusp = aces2_1200_gamut_cusp_table_0_sample(outColor.b);
      outColor.rgb = aces2_1200_gamut_compress0(outColor.rgb, outColor.r, JMGcusp, reachMaxM);
    }
    
    // Add JMh to RGB
    
    {
      vec3 JMh = outColor.rgb;
      vec3 Aab;
      {
        Aab.r = pow(JMh.r * 0.00999999978, 0.879464149);
        Aab.g = JMh.g * cos_hr;
        Aab.b = JMh.g * sin_hr;
      }
      {
        vec3 rgb_a = mat3(0.0323680267, 0.0323680267, 0.0323680267, 2.07657631e-05, -4.10250432e-05, -1.01296409e-05, 1.3260621e-05, -1.20174373e-05, -0.000290076074) * Aab.rgb;
        vec3 rgb_a_lim = min( abs(rgb_a), vec3(0.99000001, 0.99000001, 0.99000001) );
        vec3 lms = sign(rgb_a) * pow( 27.1299992 * rgb_a_lim / (1.0f - rgb_a_lim), vec3(2.38095236, 2.38095236, 2.38095236));
        JMh.rgb = mat3(7.45048571, -1.4750675, 0.0106288502, -6.1301837, 3.11835742, -0.31857267, -0.0603808537, -0.383369029, 1.56786489) * lms;
      }
      outColor.rgb = JMh;
    }
  }
  
  // Add Range processing
  
  {
    outColor.rgb = max(vec3(0., 0., 0.), outColor.rgb);
    outColor.rgb = min(vec3(12., 12., 12.), outColor.rgb);
  }

  return outColor;
}

vec3 encodeSignedSRGB(vec3 x){
  vec3 a=abs(x);
  return sign(x)*mix(1.055*pow(a,vec3(1./2.4))-.055,12.92*a,lessThanEqual(a,vec3(.0031308)));
}
void main(){
  vec3 mapped=aces2Display1200(vec4(texture(tInput,vUv).rgb,1.)).rgb;
  vec3 outRGB=mapped*uNitsToLinear;
  colour=vec4(uEncodeSRGB==0?outRGB:encodeSignedSRGB(outRGB),1.);
}
