import * as THREE from 'three';
/** Anatomical cross sections: height, half width, half depth, forward offset. */
type Section=[number,number,number,number?];
function surface(sections:Section[],segments=24){const positions:number[]=[],uv:number[]=[],indices:number[]=[];for(let j=0;j<sections.length;j++){const [y,w,d,z=0]=sections[j];for(let i=0;i<=segments;i++){const a=i/segments*Math.PI*2;positions.push(Math.sin(a)*w,y,Math.cos(a)*d+z);uv.push(i/segments,j/(sections.length-1))}}for(let j=0;j<sections.length-1;j++)for(let i=0;i<segments;i++){const a=j*(segments+1)+i,b=a+segments+1;indices.push(a,a+1,b,a+1,b+1,b)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;}
export const humanGeometry={
 torso:surface([[-.51,.69,.78],[-.46,.79,.88],[-.3,.78,.83],[-.1,.86,.94],[.12,1,.97],[.29,1.08,.88],[.4,.97,.78],[.49,.53,.53],[.52,.32,.45]]),
 head:surface([[-1,.13,.24,.08],[-.87,.47,.57,.15],[-.64,.72,.78,.1],[-.32,.92,.88,.03],[.05,.96,.93],[.3,.96,.91,-.02],[.58,.91,.84,-.05],[.8,.71,.68,-.08],[.96,.36,.38,-.08],[1,.02,.02,-.08]]),
 thigh:surface([[-1,.55,.6],[-.85,.62,.66],[-.58,.75,.82],[0,.96,1],[.55,.98,.99],[.85,.85,.85],[1,.5,.55]]),
 calf:surface([[-1,.48,.5],[-.85,.49,.53],[-.5,.58,.7],[-.1,.81,.93],[.3,1,1],[.65,.88,.83],[1,.72,.73]]),
 upperArm:surface([[-1,.65,.63],[-.7,.73,.73],[-.1,.95,.95],[.45,1,1],[.8,.85,.88],[1,.35,.4]]),
 forearm:surface([[-1,.5,.56],[-.7,.57,.62],[-.3,.72,.8],[.3,.95,.94],[.7,1,1],[1,.73,.76]]),
};
