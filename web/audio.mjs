/** Synthesized sound effects; audio starts only after a user gesture. */
export class Audio {
  constructor(){this.enabled=true;this.context=null;this.lastShot=0;}
  unlock(){if(!this.enabled)return;try{this.context??=new (globalThis.AudioContext||globalThis.webkitAudioContext)();if(this.context.state==='suspended')this.context.resume().catch(()=>{});}catch{this.enabled=false;}}
  play(type){const c=this.context;if(!this.enabled||!c||c.state!=='running')return;if(type==='shot'&&c.currentTime-this.lastShot<.11)return;if(type==='shot')this.lastShot=c.currentTime;
    const sounds={shot:[640,180,.07,.035,'triangle'],kill:[180,45,.18,.07,'sawtooth'],damage:[90,35,.22,.12,'square'],dash:[130,900,.2,.055,'sine'],pickup:[500,1100,.18,.055,'sine'],level:[220,660,.35,.05,'sine'],boss:[180,55,.7,.08,'sawtooth'],bossShot:[120,60,.12,.04,'triangle'],clear:[420,900,.4,.06,'sine'],victory:[400,1600,.8,.08,'sine'],gameover:[220,40,.7,.08,'triangle'],upgrade:[600,1200,.2,.05,'sine']};
    const s=sounds[type];if(!s)return;const [start,end,duration,volume,wave]=s,o=c.createOscillator(),g=c.createGain();o.type=wave;o.frequency.setValueAtTime(start,c.currentTime);o.frequency.exponentialRampToValueAtTime(end,c.currentTime+duration);g.gain.setValueAtTime(volume,c.currentTime);g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+duration);o.connect(g);g.connect(c.destination);o.start();o.stop(c.currentTime+duration);o.onended=()=>{o.disconnect();g.disconnect();};
  }
}
