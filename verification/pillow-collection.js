(function(root,factory){if(typeof module==='object'&&module.exports)module.exports=factory();else root.PillowCollection=factory();})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='pillow-v2-ultimate-unlocked';
  class Collection {
    constructor(storage,count){this.storage=storage;this.count=count;this.ultimate=false;try{this.ultimate=storage.getItem(KEY)==='1';}catch{}}
    isUnlocked(tier){return tier<this.count-1||this.ultimate;}
    recordMerge(inputTier){if(inputTier!==this.count-2||this.ultimate)return false;this.ultimate=true;try{this.storage.setItem(KEY,'1');}catch{}return true;}
  }
  return {Collection,KEY};
});
