type MilestoneSequenceLike = {
  subGuideRef: string;
  stepFrom?: number | null;
  stepTo?: number | null;
};

export function buildMilestoneStepKeys(sequences: MilestoneSequenceLike[]): string[] {
  const stepKeys: string[] = [];

  for (const seq of sequences) {
    if (seq.stepFrom !== null && seq.stepFrom !== undefined && seq.stepTo !== null && seq.stepTo !== undefined) {
      for (let i = seq.stepFrom; i <= seq.stepTo; i++) {
        stepKeys.push(`${seq.subGuideRef}-${i}`);
      }
    } else {
      stepKeys.push(`${seq.subGuideRef}-all`);
    }
  }

  return stepKeys;
}
