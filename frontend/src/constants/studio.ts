export interface NonVerbalSymbol {
  tag: string;
  label: string;
  emoji: string;
}

export const NON_VERBAL_SYMBOLS: NonVerbalSymbol[] = [
  { tag: "[laughter]", label: "Cười", emoji: "😄" },
  { tag: "[sigh]", label: "Thở dài", emoji: "😮‍💨" },
  { tag: "[surprise-ah]", label: "Ngạc nhiên (Ah)", emoji: "😲" },
  { tag: "[surprise-oh]", label: "Bất ngờ (Oh)", emoji: "😯" },
  { tag: "[dissatisfaction-hnn]", label: "Khó chịu", emoji: "😤" },
  { tag: "[question-ah]", label: "Nghi vấn (Ah)", emoji: "❓" },
];

export interface DesignPreset {
  label: string;
  gender: "female" | "male";
  age: "child" | "teenager" | "young adult" | "middle-aged" | "elderly";
  pitch:
    | "very low pitch"
    | "low pitch"
    | "moderate pitch"
    | "high pitch"
    | "very high pitch";
  style: "normal" | "whisper";
}

export const DESIGN_PRESETS: DesignPreset[] = [
  {
    label: "Nữ thanh niên trong trẻo",
    gender: "female",
    age: "young adult",
    pitch: "high pitch",
    style: "normal",
  },
  {
    label: "Nam trung niên trầm ấm",
    gender: "male",
    age: "middle-aged",
    pitch: "low pitch",
    style: "normal",
  },
  {
    label: "Nam thanh niên truyền cảm",
    gender: "male",
    age: "young adult",
    pitch: "moderate pitch",
    style: "normal",
  },
  {
    label: "Nữ thì thầm bí ẩn",
    gender: "female",
    age: "young adult",
    pitch: "moderate pitch",
    style: "whisper",
  },
  {
    label: "Bé gái đáng yêu",
    gender: "female",
    age: "child",
    pitch: "high pitch",
    style: "normal",
  },
  {
    label: "Cụ già chậm rãi",
    gender: "male",
    age: "elderly",
    pitch: "low pitch",
    style: "normal",
  },
];
