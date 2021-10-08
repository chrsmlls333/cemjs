// three.js Supplemental ///////////////////////////////////////////////

export const clearScene = sceneForClearing => {
  for (var i = sceneForClearing.children.length - 1; i >= 0; i--) {
    sceneForClearing.remove(sceneForClearing.children[i]);
  }
};