import type { CSSProperties, ComponentType } from "react";
import type { LucideProps } from "lucide-react";

export interface AppIconProps {
  size?: number;
  style?: CSSProperties;
}

export function createAppIcon(Icon: ComponentType<LucideProps>, defaultSize = 16) {
  return function AppIcon({ size = defaultSize, style }: AppIconProps) {
    return <Icon size={size} style={style} strokeWidth={2} />;
  };
}
