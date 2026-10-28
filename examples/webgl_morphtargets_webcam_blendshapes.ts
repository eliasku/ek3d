const blendshapesMap: Record<string, string> = {
  // '_neutral': '',
  browDownLeft: "browDown_L",
  browDownRight: "browDown_R",
  browInnerUp: "browInnerUp",
  browOuterUpLeft: "browOuterUp_L",
  browOuterUpRight: "browOuterUp_R",
  cheekPuff: "cheekPuff",
  cheekSquintLeft: "cheekSquint_L",
  cheekSquintRight: "cheekSquint_R",
  eyeBlinkLeft: "eyeBlink_L",
  eyeBlinkRight: "eyeBlink_R",
  eyeLookDownLeft: "eyeLookDown_L",
  eyeLookDownRight: "eyeLookDown_R",
  eyeLookInLeft: "eyeLookIn_L",
  eyeLookInRight: "eyeLookIn_R",
  eyeLookOutLeft: "eyeLookOut_L",
  eyeLookOutRight: "eyeLookOut_R",
  eyeLookUpLeft: "eyeLookUp_L",
  eyeLookUpRight: "eyeLookUp_R",
  eyeSquintLeft: "eyeSquint_L",
  eyeSquintRight: "eyeSquint_R",
  eyeWideLeft: "eyeWide_L",
  eyeWideRight: "eyeWide_R",
  jawForward: "jawForward",
  jawLeft: "jawLeft",
  jawOpen: "jawOpen",
  jawRight: "jawRight",
  mouthClose: "mouthClose",
  mouthDimpleLeft: "mouthDimple_L",
  mouthDimpleRight: "mouthDimple_R",
  mouthFrownLeft: "mouthFrown_L",
  mouthFrownRight: "mouthFrown_R",
  mouthFunnel: "mouthFunnel",
  mouthLeft: "mouthLeft",
  mouthLowerDownLeft: "mouthLowerDown_L",
  mouthLowerDownRight: "mouthLowerDown_R",
  mouthPressLeft: "mouthPress_L",
  mouthPressRight: "mouthPress_R",
  mouthPucker: "mouthPucker",
  mouthRight: "mouthRight",
  mouthRollLower: "mouthRollLower",
  mouthRollUpper: "mouthRollUpper",
  mouthShrugLower: "mouthShrugLower",
  mouthShrugUpper: "mouthShrugUpper",
  mouthSmileLeft: "mouthSmile_L",
  mouthSmileRight: "mouthSmile_R",
  mouthStretchLeft: "mouthStretch_L",
  mouthStretchRight: "mouthStretch_R",
  mouthUpperUpLeft: "mouthUpperUp_L",
  mouthUpperUpRight: "mouthUpperUp_R",
  noseSneerLeft: "noseSneer_L",
  noseSneerRight: "noseSneer_R",
  // '': 'tongueOut'
};

export function applyBlendshapes(
  categories: readonly { categoryName: string; score: number }[],
  dictionary: Record<string, number>,
  influences: number[],
  left: { rotation: { x: number; z: number } },
  right: { rotation: { x: number; z: number } },
): void {
  let lh = 0,
    rh = 0,
    lv = 0,
    rv = 0;
  for (const { categoryName, score } of categories) {
    const index = dictionary[blendshapesMap[categoryName]];
    if (index !== undefined) influences[index] = score;
    switch (categoryName) {
      case "eyeLookInLeft":
        lh += score;
        break;
      case "eyeLookOutLeft":
        lh -= score;
        break;
      case "eyeLookInRight":
        rh -= score;
        break;
      case "eyeLookOutRight":
        rh += score;
        break;
      case "eyeLookUpLeft":
        lv -= score;
        break;
      case "eyeLookDownLeft":
        lv += score;
        break;
      case "eyeLookUpRight":
        rv -= score;
        break;
      case "eyeLookDownRight":
        rv += score;
        break;
    }
  }
  const limit = Math.PI / 6;
  left.rotation.z = lh * limit;
  right.rotation.z = rh * limit;
  left.rotation.x = lv * limit;
  right.rotation.x = rv * limit;
}
