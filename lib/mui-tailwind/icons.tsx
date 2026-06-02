'use client';

import React from 'react';
import * as Lucide from 'lucide-react';

// Unified wrapper to make Lucide icons behave exactly like MUI icons
const createIcon = (LucideIcon: any) => {
  const IconComponent = React.forwardRef(({ fontSize = 'medium', className, style, ...props }: any, ref) => {
    if (!LucideIcon) return null;
    
    // Map MUI fontSize to size values
    let size = 20;
    if (fontSize === 'small') size = 16;
    if (fontSize === 'large') size = 28;
    if (typeof fontSize === 'number') size = fontSize;

    return (
      <LucideIcon
        ref={ref}
        size={size}
        className={className}
        style={style}
        {...props}
      />
    );
  });
  IconComponent.displayName = 'IconComponent';
  return IconComponent;
};

// Common Lucide exports
export const Plus = createIcon(Lucide.Plus);
export const Minus = createIcon(Lucide.Minus);
export const Trash2 = createIcon(Lucide.Trash2);
export const Pencil = createIcon(Lucide.Pencil);
export const SearchIcon = createIcon(Lucide.Search);
export const SettingsIcon = createIcon(Lucide.Settings);
export const XIcon = createIcon(Lucide.X);
export const MenuIcon = createIcon(Lucide.Menu);
export const ChevronRightIcon = createIcon(Lucide.ChevronRight);
export const ChevronLeftIcon = createIcon(Lucide.ChevronLeft);
export const ChevronUpIcon = createIcon(Lucide.ChevronUp);
export const ChevronDownIcon = createIcon(Lucide.ChevronDown);
export const ArrowLeftIcon = createIcon(Lucide.ArrowLeft);
export const ArrowRightIcon = createIcon(Lucide.ArrowRight);
export const ArrowUpIcon = createIcon(Lucide.ArrowUp);
export const ArrowDownIcon = createIcon(Lucide.ArrowDown);
export const EyeIcon = createIcon(Lucide.Eye);
export const EyeOffIcon = createIcon(Lucide.EyeOff);
export const CheckIcon = createIcon(Lucide.Check);
export const InfoIcon = createIcon(Lucide.Info);
export const AlertTriangle = createIcon(Lucide.AlertTriangle);
export const AlertCircle = createIcon(Lucide.AlertCircle);
export const CheckCircle = createIcon(Lucide.CheckCircle);
export const HelpCircle = createIcon(Lucide.HelpCircle);
export const HomeIcon = createIcon(Lucide.Home);
export const UserIcon = createIcon(Lucide.User);
export const UsersIcon = createIcon(Lucide.Users);
export const MailIcon = createIcon(Lucide.Mail);
export const PhoneIcon = createIcon(Lucide.Phone);
export const LockIcon = createIcon(Lucide.Lock);
export const CalendarIcon = createIcon(Lucide.Calendar);
export const MessageSquare = createIcon(Lucide.MessageSquare);
export const SendIcon = createIcon(Lucide.Send);
export const BellIcon = createIcon(Lucide.Bell);
export const Paperclip = createIcon(Lucide.Paperclip);
export const ImageIcon = createIcon(Lucide.Image);
export const Share2 = createIcon(Lucide.Share2);
export const UploadIcon = createIcon(Lucide.Upload);
export const DownloadIcon = createIcon(Lucide.Download);
export const CopyIcon = createIcon(Lucide.Copy);
export const StarIcon = createIcon(Lucide.Star);
export const HistoryIcon = createIcon(Lucide.History);
export const LogOutIcon = createIcon(Lucide.LogOut);
export const MoreVertical = createIcon(Lucide.MoreVertical);
export const MoreHorizontal = createIcon(Lucide.MoreHorizontal);
export const PlayIcon = createIcon(Lucide.Play);
export const PauseIcon = createIcon(Lucide.Pause);
export const Volume2 = createIcon(Lucide.Volume2);
export const VolumeX = createIcon(Lucide.VolumeX);
export const MicIcon = createIcon(Lucide.Mic);
export const MicOffIcon = createIcon(Lucide.MicOff);
export const VideoIcon = createIcon(Lucide.Video);
export const VideoOffIcon = createIcon(Lucide.VideoOff);
export const FolderIcon = createIcon(Lucide.Folder);
export const FileIcon = createIcon(Lucide.File);
export const ListIcon = createIcon(Lucide.List);
export const GridIcon = createIcon(Lucide.Grid);
export const Sliders = createIcon(Lucide.Sliders);
export const FilterIcon = createIcon(Lucide.Filter);
export const CircleIcon = createIcon(Lucide.Circle);

// MUI Specific Aliases
export const Add = Plus;
export const AddCircle = createIcon(Lucide.PlusCircle);
export const Remove = Minus;
export const Delete = Trash2;
export const Edit = Pencil;
export const Search = SearchIcon;
export const Settings = SettingsIcon;
export const Close = XIcon;
export const Menu = MenuIcon;
export const ChevronRight = ChevronRightIcon;
export const ChevronLeft = ChevronLeftIcon;
export const ChevronUp = ChevronUpIcon;
export const ChevronDown = ChevronDownIcon;
export const ArrowBack = ArrowLeftIcon;
export const ArrowForward = ArrowRightIcon;
export const ArrowUpward = ArrowUpIcon;
export const ArrowDownward = ArrowDownIcon;
export const Visibility = EyeIcon;
export const VisibilityOff = EyeOffIcon;
export const Check = CheckIcon;
export const Info = InfoIcon;
export const Warning = AlertTriangle;
export const Error = AlertCircle;
export const Success = CheckCircle;
export const Help = HelpCircle;
export const Home = HomeIcon;
export const Person = UserIcon;
export const People = UsersIcon;
export const Email = MailIcon;
export const Phone = PhoneIcon;
export const Lock = LockIcon;
export const CalendarToday = CalendarIcon;
export const Chat = MessageSquare;
export const Send = SendIcon;
export const Notifications = BellIcon;
export const AttachFile = Paperclip;
export const Image = ImageIcon;
export const Share = Share2;
export const CloudUpload = UploadIcon;
export const CloudDownload = DownloadIcon;
export const Copy = CopyIcon;
export const Star = StarIcon;
export const History = HistoryIcon;
export const LogOut = LogOutIcon;
export const MoreVert = MoreVertical;
export const MoreHoriz = MoreHorizontal;
export const PlayArrow = PlayIcon;
export const Pause = PauseIcon;
export const VolumeUp = Volume2;
export const VolumeOff = VolumeX;
export const Mic = MicIcon;
export const MicOff = MicOffIcon;
export const Videocam = VideoIcon;
export const VideocamOff = VideoOffIcon;
export const Folder = FolderIcon;
export const InsertDriveFile = FileIcon;
export const List = ListIcon;
export const GridView = GridIcon;
export const Tune = Sliders;
export const FilterList = FilterIcon;
export const CheckCircleOutline = CheckCircle;
export const RadioButtonUnchecked = CircleIcon;
export const LockOutlined = LockIcon;
export const ContentCopy = CopyIcon;
export const Done = CheckIcon;
export const Refresh = createIcon(Lucide.RefreshCw);
export const Security = createIcon(Lucide.Shield);
export const Key = createIcon(Lucide.Key);
export const Download = DownloadIcon;
export const Upload = UploadIcon;
export const Link = createIcon(Lucide.Link);
export const OpenInNew = createIcon(Lucide.ExternalLink);
export const FileDownload = DownloadIcon;
export const Description = createIcon(Lucide.FileText);
export const Event = CalendarIcon;
export const Group = UsersIcon;
export const Public = createIcon(Lucide.Globe);
export const Shield = createIcon(Lucide.Shield);
export const VpnKey = createIcon(Lucide.Key);
export const Cloud = createIcon(Lucide.Cloud);
export const CheckBox = createIcon(Lucide.CheckSquare);
export const CheckBoxOutlineBlank = createIcon(Lucide.Square);
export const KeyboardArrowUp = ChevronUpIcon;
export const KeyboardArrowDown = ChevronDownIcon;
export const KeyboardArrowRight = ChevronRightIcon;
export const KeyboardArrowLeft = ChevronLeftIcon;
export const SendRounded = SendIcon;
export const SmartToy = createIcon(Lucide.Bot);
export const Code = createIcon(Lucide.Code);
export const PlayCircle = createIcon(Lucide.PlayCircle);

// Create a Proxy to dynamically handle any other requested icon name
const fallbackProxy = new Proxy({}, {
  get: (target, propName: string) => {
    // If the component is already exported, return it
    if (propName in target) return (target as any)[propName];
    
    // Look up in Lucide using exact name or matching logic
    const lucideName = propName.replace(/Outlined|Rounded|Sharp/g, '');
    const LucideComponent = (Lucide as any)[lucideName] || Lucide.HelpCircle;
    return createIcon(LucideComponent);
  }
});

export default fallbackProxy;
