'use client';

import React from 'react';
import * as Lucide from 'lucide-react';

const resolveIconSize = (fontSize: any, sx?: any) => {
  const fromSx = sx?.fontSize;
  const raw = fromSx ?? fontSize ?? 'medium';
  if (raw === 'inherit') return 20;
  if (raw === 'small') return 16;
  if (raw === 'large') return 28;
  if (typeof raw === 'number') return raw;
  if (typeof raw === 'string' && raw.endsWith('rem')) return parseFloat(raw) * 16;
  if (typeof raw === 'string' && raw.endsWith('px')) return parseFloat(raw);
  return 20;
};

// Unified wrapper to make Lucide icons behave like OpenBricks icon primitives
const createIcon = (LucideIcon: any, defaults?: { strokeWidth?: number; fill?: string }) => {
  const IconComponent = React.forwardRef(({ fontSize = 'medium', className, style, sx, ...props }: any, ref) => {
    if (!LucideIcon) return null;

    const size = resolveIconSize(fontSize, sx);
    const sxStyle = sx && typeof sx === 'object' ? sx : {};

    return (
      <LucideIcon
        ref={ref}
        size={size}
        strokeWidth={props.strokeWidth ?? defaults?.strokeWidth ?? 1.75}
        fill={props.fill ?? defaults?.fill ?? 'none'}
        className={className}
        style={{ ...sxStyle, ...style }}
        {...props}
      />
    );
  });
  IconComponent.displayName = LucideIcon?.displayName || 'IconComponent';
  return IconComponent;
};

// Common Lucide exports
const Plus = createIcon(Lucide.Plus);
const Minus = createIcon(Lucide.Minus);
const Trash2 = createIcon(Lucide.Trash2);
const Pencil = createIcon(Lucide.Pencil);
const SearchIcon = createIcon(Lucide.Search);
const SettingsIcon = createIcon(Lucide.Settings);
const XIcon = createIcon(Lucide.X);
const MenuIcon = createIcon(Lucide.Menu);
const ChevronRightIcon = createIcon(Lucide.ChevronRight);
const ChevronLeftIcon = createIcon(Lucide.ChevronLeft);
const ChevronUpIcon = createIcon(Lucide.ChevronUp);
export const ChevronDownIcon = createIcon(Lucide.ChevronDown);
const ArrowLeftIcon = createIcon(Lucide.ArrowLeft);
const ArrowRightIcon = createIcon(Lucide.ArrowRight);
const ArrowUpIcon = createIcon(Lucide.ArrowUp);
const ArrowDownIcon = createIcon(Lucide.ArrowDown);
const EyeIcon = createIcon(Lucide.Eye);
const EyeOffIcon = createIcon(Lucide.EyeOff);
const CheckIcon = createIcon(Lucide.Check);
const InfoIcon = createIcon(Lucide.Info);
const AlertTriangle = createIcon(Lucide.AlertTriangle);
const AlertCircle = createIcon(Lucide.AlertCircle);
export const CheckCircle = createIcon(Lucide.CheckCircle);
const HelpCircle = createIcon(Lucide.HelpCircle);
const HomeIcon = createIcon(Lucide.Home);
const UserIcon = createIcon(Lucide.User);
const UsersIcon = createIcon(Lucide.Users);
const MailIcon = createIcon(Lucide.Mail);
export const PhoneIcon = createIcon(Lucide.Phone);
export const LockIcon = createIcon(Lucide.Lock);
const CalendarIcon = createIcon(Lucide.Calendar);
const MessageSquare = createIcon(Lucide.MessageSquare);
const SendIcon = createIcon(Lucide.Send);
const BellIcon = createIcon(Lucide.Bell);
const Paperclip = createIcon(Lucide.Paperclip);
const ImageIcon = createIcon(Lucide.Image);
const Share2 = createIcon(Lucide.Share2);
const UploadIcon = createIcon(Lucide.Upload);
const DownloadIcon = createIcon(Lucide.Download);
const CopyIcon = createIcon(Lucide.Copy);
const StarIcon = createIcon(Lucide.Star);
const HistoryIcon = createIcon(Lucide.History);
const LogOutIcon = createIcon(Lucide.LogOut);
const MoreVertical = createIcon(Lucide.MoreVertical);
const MoreHorizontal = createIcon(Lucide.MoreHorizontal);
const PlayIcon = createIcon(Lucide.Play);
const PauseIcon = createIcon(Lucide.Pause);
const Volume2 = createIcon(Lucide.Volume2);
const VolumeX = createIcon(Lucide.VolumeX);
const MicIcon = createIcon(Lucide.Mic);
const MicOffIcon = createIcon(Lucide.MicOff);
const VideoIcon = createIcon(Lucide.Video);
const VideoOffIcon = createIcon(Lucide.VideoOff);
const FolderIcon = createIcon(Lucide.Folder);
const FileIcon = createIcon(Lucide.File);
const ListIcon = createIcon(Lucide.List);
const GridIcon = createIcon(Lucide.Grid);
const Sliders = createIcon(Lucide.Sliders);
const FilterIcon = createIcon(Lucide.Filter);
const CircleIcon = createIcon(Lucide.Circle);

// Legacy icon name aliases (prefer Lucide names in new code)
export const Add = Plus;
export const Remove = Minus;
export const Delete = Trash2;
export const Edit = Pencil;
export const Search = SearchIcon;
export const Settings = SettingsIcon;
export const Close = XIcon;
export const ChevronRight = ChevronRightIcon;
export const ChevronLeft = ChevronLeftIcon;
export const ArrowBack = ArrowLeftIcon;
export const Visibility = EyeIcon;
export const VisibilityOff = EyeOffIcon;
export const Warning = AlertTriangle;
export const Home = HomeIcon;
export const Lock = LockIcon;
export const Chat = MessageSquare;
export const Send = SendIcon;
export const CloudUpload = UploadIcon;
export const MoreVert = MoreVertical;
export const PlayArrow = PlayIcon;
export const Folder = FolderIcon;
export const List = ListIcon;
export const ContentCopy = CopyIcon;
export const Refresh = createIcon(Lucide.RefreshCw);
export const Security = createIcon(Lucide.Shield);
export const Key = createIcon(Lucide.Key);
export const Description = createIcon(Lucide.FileText);
const Public = createIcon(Lucide.Globe);
export const Shield = createIcon(Lucide.Shield);
export const CheckBox = createIcon(Lucide.CheckSquare);

// Create a Proxy to dynamically handle any other requested icon name


export const Abc = createIcon(Lucide.Type);
export const AlternateEmail = createIcon(Lucide.Mail);
export const Apps = createIcon((Lucide as any).Apps || Lucide.HelpCircle);
export const AutoAwesome = createIcon((Lucide as any).AutoAwesome || Lucide.HelpCircle);
export const Block = createIcon((Lucide as any).Block || Lucide.HelpCircle);
export const Circle = createIcon((Lucide as any).Circle || Lucide.HelpCircle);
export const DeleteOutline = createIcon((Lucide as any).DeleteOutline || Lucide.HelpCircle);
export const EmojiEmotionsOutlined = createIcon((Lucide as any).EmojiEmotionsOutlined || Lucide.HelpCircle);
export const ErrorOutline = createIcon((Lucide as any).ErrorOutline || Lucide.HelpCircle);
export const ExpandLess = createIcon((Lucide as any).ExpandLess || Lucide.HelpCircle);
export const ExpandMore = createIcon((Lucide as any).ExpandMore || Lucide.HelpCircle);
export const FiberPin = createIcon((Lucide as any).FiberPin || Lucide.HelpCircle);
export const FingerprintOutlined = createIcon((Lucide as any).FingerprintOutlined || Lucide.HelpCircle);
export const Logout = createIcon((Lucide as any).Logout || Lucide.HelpCircle);
export const NoteAdd = createIcon((Lucide as any).NoteAdd || HelpCircle);
export const Notes = createIcon(Lucide.FileText);
export const Numbers = createIcon(Lucide.Hash);
export const OpenInFull = createIcon((Lucide as any).OpenInFull || Lucide.HelpCircle);
/** Filled pin (pinned state) — matches MUI PushPin */
export const PushPin = createIcon(Lucide.Pin, { strokeWidth: 2, fill: 'currentColor' });
/** Outline pin (unpinned) — matches MUI PushPinOutlined */
export const RadioButtonChecked = createIcon(Lucide.CircleDot);
export const Reply = createIcon((Lucide as any).Reply || Lucide.HelpCircle);
export const RotateLeft = createIcon((Lucide as any).RotateLeft || Lucide.HelpCircle);
export const Sync = createIcon((Lucide as any).Sync || Lucide.HelpCircle);
export const ToggleOn = createIcon((Lucide as any).ToggleOn || Lucide.HelpCircle);
export const UploadFile = createIcon(Lucide.Upload);
export const Telegram = createIcon(Lucide.Send);

