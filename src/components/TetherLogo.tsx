import tetherLogo from "@/assets/tether-logo.png";

interface TetherLogoProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}

const sizes = {
  sm: "h-5 w-5",
  md: "h-7 w-7",
  lg: "h-9 w-9",
};

const textSizes = {
  sm: "text-base",
  md: "text-xl",
  lg: "text-2xl",
};

export default function TetherLogo({ size = "md", showText = true, className = "" }: TetherLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <img src={tetherLogo} alt="Tether" className={sizes[size]} />
      {showText && (
        <span className={`font-display font-bold text-primary tracking-tight ${textSizes[size]}`}>TETHER</span>
      )}
    </span>
  );
}
