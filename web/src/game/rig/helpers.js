// Interpolation + keyframe-track helpers shared by rigs and VFX.
export class Helpers {
  lerp(a,b,t){ return a+(b-a)*t; }
  seg(ph,a,b){ return ph<=a?0 : ph>=b?1 : (ph-a)/(b-a); }
  ease(t){ return t<.5 ? 2*t*t : 1-Math.pow(-2*t+2,2)/2; }
  out(t){ return 1-Math.pow(1-t,3); }
  inn(t){ return t*t*t; }
  track(ph, kf, easing){
    for(let i=0;i<kf.length-1;i++){
      const a=kf[i], b=kf[i+1];
      if(ph>=a[0] && ph<=b[0]){
        let t=(ph-a[0])/(b[0]-a[0]||1);
        t = easing==="out"?this.out(t): easing==="in"?this.inn(t): this.ease(t);
        return this.lerp(a[1],b[1],t);
      }
    }
    return ph<kf[0][0]? kf[0][1] : kf[kf.length-1][1];
  }
}
export const H = new Helpers();
