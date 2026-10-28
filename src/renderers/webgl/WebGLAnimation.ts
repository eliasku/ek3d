export function WebGLAnimation() {
  let context: any = null;
  let isAnimating = false;
  let animationLoop: any = null;
  let requestId: any = null;
  function onAnimationFrame(time?: any) {
    requestId = context.requestAnimationFrame(onAnimationFrame);
    animationLoop(time);
  }
  return {
    start: function () {
      if (isAnimating === true) return;
      if (animationLoop === null) return;
      if (context === null) return;
      requestId = context.requestAnimationFrame(onAnimationFrame);
      isAnimating = true;
    },
    stop: function () {
      if (context !== null) context.cancelAnimationFrame(requestId);
      isAnimating = false;
    },
    setAnimationLoop: function (callback?: any) {
      animationLoop = callback;
    },
    setContext: function (value?: any) {
      context = value;
    },
  };
}
