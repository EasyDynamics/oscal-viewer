import type { CSSProperties } from "react";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  ArrowDown,
  BookOpen,
  Box,
  Calendar,
  Check,
  CircleCheck,
  CircleMinus,
  CirclePlus,
  ClipboardList,
  Cloud,
  CodeXml,
  Cpu,
  Database,
  Download,
  Flame,
  HardDrive,
  Mail,
  Phone,
  Router,
  ServerCog,
  UserCog,
  ExternalLink,
  Eye,
  FileCode,
  FileText,
  Flag,
  Folder,
  Globe,
  House,
  Info,
  Layers,
  Lightbulb,
  Link2,
  List,
  Monitor,
  Network,
  Paperclip,
  Search,
  Server,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  SquareCheckBig,
  Tag,
  Target,
  TriangleAlert,
  Upload,
  Users,
  Workflow,
  Wrench,
  XCircle,
  ChevronRight,
} from "lucide-react";
import { createAppIcon, type AppIconProps } from "./LucideIcon";
import { alpha, colors, radii } from "../theme/tokens";

export type IconProps = AppIconProps;

export const IcoUpload = createAppIcon(Upload, 20);
export const IcoShield = createAppIcon(Shield);
export const IcoHome = createAppIcon(House);
export const IcoInfo = createAppIcon(Info);
export const IcoServer = createAppIcon(Server);
export const IcoCube = createAppIcon(Box);
export const IcoBox = createAppIcon(Box);
export const IcoLayers = createAppIcon(Layers);
export const IcoUsers = createAppIcon(Users);
export const IcoClipboard = createAppIcon(ClipboardList);
export const IcoBook = createAppIcon(BookOpen);
export const IcoCode = createAppIcon(CodeXml);
export const IcoLink = createAppIcon(Link2, 14);
export const IcoExternalLink = createAppIcon(ExternalLink, 14);
export const IcoPaperclip = createAppIcon(Paperclip, 14);
export const IcoFolder = createAppIcon(Folder);
export const IcoTag = createAppIcon(Tag, 14);
export const IcoThisSystem = createAppIcon(Monitor);
export const IcoExternalSystem = createAppIcon(Server);
export const IcoInterconnection = createAppIcon(Network);
export const IcoSoftware = createAppIcon(CodeXml);
export const IcoHardware = createAppIcon(Cpu);
export const IcoService = createAppIcon(Cloud);
export const IcoPolicy = createAppIcon(FileText);
export const IcoPhysical = createAppIcon(Globe);
export const IcoProcessProcedure = createAppIcon(Workflow);
export const IcoPlan = createAppIcon(Calendar);
export const IcoGuidance = createAppIcon(Target);
export const IcoStandard = createAppIcon(SquareCheckBig);
export const IcoValidation = createAppIcon(ShieldCheck);
export const IcoAlertTriangle = createAppIcon(TriangleAlert);
export const IcoNetwork = createAppIcon(Network);
export const IcoList = createAppIcon(List);
export const IcoBulb = createAppIcon(Lightbulb);
export const IcoCheck = createAppIcon(Check);
export const IcoSearch = createAppIcon(Search);
export const IcoAlert = createAppIcon(AlertCircle);
export const IcoTarget = createAppIcon(Target);
export const IcoEye = createAppIcon(Eye);
export const IcoCalendar = createAppIcon(Calendar);
export const IcoCheckCircle = createAppIcon(CircleCheck);
export const IcoFlag = createAppIcon(Flag);
export const IcoTool = createAppIcon(Wrench);
export const IcoXCircle = createAppIcon(XCircle);
export const IcoSliders = createAppIcon(SlidersHorizontal);
export const IcoDownload = createAppIcon(Download);
export const IcoPlus = createAppIcon(CirclePlus, 14);
export const IcoMinus = createAppIcon(CircleMinus, 14);
export const IcoDatabase = createAppIcon(Database);
export const IcoArrowDown = createAppIcon(ArrowDown);
export const IcoAct = createAppIcon(Activity);
export const IcoTask = createAppIcon(ClipboardList);
export const IcoRight = createAppIcon(ChevronRight, 14);
export const IcoCloud = createAppIcon(Cloud);
export const IcoFileCode = createAppIcon(FileCode);
export const IcoHardDrive = createAppIcon(HardDrive);
export const IcoMail = createAppIcon(Mail);
export const IcoPhone = createAppIcon(Phone);
export const IcoRouter = createAppIcon(Router);
export const IcoServerCog = createAppIcon(ServerCog);
export const IcoUserCog = createAppIcon(UserCog);
export const IcoFlame = createAppIcon(Flame);

export function IcoChev({ open, style }: { open: boolean; style?: CSSProperties }) {
  return <ChevronRight size={12} style={{ ...style, transform: open ? "rotate(90deg)" : "rotate(0)", transition: "transform .15s", flexShrink: 0 }} strokeWidth={2.5} />;
}

export function IcoShieldLayers({ size = 16, style }: IconProps) {
  return <IconWithBadge size={size} style={style} Base={Shield} Badge={Layers} badgeColor={colors.purple} />;
}

export function IcoFolderLayers({ size = 16, style }: IconProps) {
  return <IconWithBadge size={size} style={style} Base={Folder} Badge={Layers} badgeColor={colors.purple} />;
}

export function IcoFolderShieldLayers({ size = 16, style }: IconProps) {
  return <IconWithBadge size={size} style={style} Base={Folder} Badge={Shield} badgeColor={colors.orange} />;
}

function IconWithBadge({
  size = 16,
  style,
  Base,
  Badge,
  badgeColor,
}: IconProps & {
  Base: LucideIcon;
  Badge: LucideIcon;
  badgeColor: string;
}) {
  const baseColor = style?.color ?? colors.purple;
  const badgeSize = Math.max(9, Math.round(size * 0.72));
  return (
    <span style={{ ...style, position: "relative", display: "inline-flex", width: size, height: size, flexShrink: 0 }}>
      <Base size={size} style={{ color: baseColor }} strokeWidth={2} />
      <span style={{
        position: "absolute", right: -4, bottom: -4,
        width: badgeSize + 3, height: badgeSize + 3,
        borderRadius: radii.pill, backgroundColor: colors.card,
        border: `1px solid ${alpha(badgeColor, 35)}`,
        display: "inline-flex", alignItems: "center", justifyContent: "center",
      }}>
        <Badge size={badgeSize} style={{ color: badgeColor }} strokeWidth={2} />
      </span>
    </span>
  );
}
