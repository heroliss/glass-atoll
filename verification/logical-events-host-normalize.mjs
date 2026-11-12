// Exact optional host layer only; does not erase unrelated source changes.
export const logicalHostEdits=Object.freeze([
  [
    "imports",
    "import {createPyroSmokeLogicalEvents} from './pyro-smoke-logical-events.js';\nimport {LOGICAL_BURN_PROFILE} from './pyro-smoke-logical-burn.js';\n",
    ""
  ],
  [
    "signature",
    "export function createPyroSmoke(THREE,renderer,{time=0,wind=[0,0,0],capacity=4096,sourceModel='legacy9',sourceProvider=null,kernelModel='point',centralFraction=.20,trajectorySlots=12,dispersionModel='brownian',lagrangianSeconds=10,emissionProfile='two-births',groundChargeFraction=.10}={}){\n",
    "export function createPyroSmoke(THREE,renderer,{time=0,wind=[0,0,0],capacity=4096,sourceModel='legacy9',sourceProvider=null,kernelModel='point',centralFraction=.20,trajectorySlots=12,dispersionModel='brownian',lagrangianSeconds=10,emissionProfile='two-births'}={}){\n"
  ],
  [
    "allowlist",
    "  if(emissionProfile!=='two-births'&&emissionProfile!=='ring-uniform-burn-v1'&&emissionProfile!=='palm-fan-uniform-burn-v1'&&emissionProfile!==LOGICAL_BURN_PROFILE)throw new RangeError('emissionProfile must be two-births,ring-uniform-burn-v1,palm-fan-uniform-burn-v1 or logical-family-continuous-v1');\n",
    "  if(emissionProfile!=='two-births'&&emissionProfile!=='ring-uniform-burn-v1'&&emissionProfile!=='palm-fan-uniform-burn-v1')throw new RangeError('emissionProfile must be two-births,ring-uniform-burn-v1 or palm-fan-uniform-burn-v1');\n"
  ],
  [
    "router",
    "  const events=sourceModel==='legacy9'?createPyroSmokeEvents({state}):emissionProfile===LOGICAL_BURN_PROFILE?createPyroSmokeLogicalEvents({state,sourceProvider,queueCapacity:8192,kernelModel,centralFraction,groundChargeFraction,dispersionModel,transport:SMOKE_SOURCE_TRANSPORT}):createPyroSmokeTrajectoryEvents({state,sourceProvider,queueCapacity:8192,kernelModel,centralFraction,trajectorySlots,dispersionModel,lagrangianSeconds,transport:SMOKE_SOURCE_TRANSPORT,...(emissionProfile==='two-births'?{}:{emissionProfile})}),columns=createPyroSmokeColumns(snapshot),volume=createPyroSmokeRenderer(THREE,renderer,{maxPackets:capacity});\n",
    "  const events=sourceModel==='legacy9'?createPyroSmokeEvents({state}):createPyroSmokeTrajectoryEvents({state,sourceProvider,queueCapacity:8192,kernelModel,centralFraction,trajectorySlots,dispersionModel,lagrangianSeconds,transport:SMOKE_SOURCE_TRANSPORT,...(emissionProfile==='two-births'?{}:{emissionProfile})}),columns=createPyroSmokeColumns(snapshot),volume=createPyroSmokeRenderer(THREE,renderer,{maxPackets:capacity});\n"
  ],
  [
    "guard",
    "  if(emissionProfile===LOGICAL_BURN_PROFILE&&(sourceModel!=='trajectory-v1'||kernelModel!=='past-segment-v2'||dispersionModel!=='brownian'))throw new RangeError('Logical profile requires explicit trajectory-v1/past-segment-v2/Brownian');\n",
    ""
  ]
]);
export function normalizeLogicalBurnHostSource(source){for(const [name,from,to]of logicalHostEdits){if(source.split(from).length!==2)throw new Error("Missing/duplicate logical host edit: "+name);source=source.replace(from,to);}return source;}
