import {
  LayoutDashboard,
  Library,
  KanbanSquare,
  NotebookPen,
  Search,
  Sparkles,
  Link2,
  X,
  Plus,
  Import,
  Settings,
  Github,
  Trash2,
  type LucideIcon,
} from 'lucide-react';

// All icons come from lucide-react (the icon set used by shadcn/ui). Thin wrappers
// keep the original `{ size, style, className, strokeWidth }` API so existing call
// sites don't change, and apply a 1.8 stroke for the app's lighter aesthetic.
interface IconProps {
  size?: number;
  style?: React.CSSProperties;
  className?: string;
  strokeWidth?: number;
}

function make(Icon: LucideIcon, defaultSize: number) {
  return function WrappedIcon({ size = defaultSize, style, className, strokeWidth = 1.8 }: IconProps) {
    return <Icon size={size} strokeWidth={strokeWidth} style={style} className={className} />;
  };
}

export const WhiteboardIcon = make(LayoutDashboard, 22);
export const LibraryIcon = make(Library, 22);
export const KanbanIcon = make(KanbanSquare, 22);
export const DiaryIcon = make(NotebookPen, 22);
export const SearchIcon = make(Search, 20);
export const SparkleIcon = make(Sparkles, 14);
export const LinkIcon = make(Link2, 12);
export const CloseIcon = make(X, 16);
export const PlusIcon = make(Plus, 18);
export const ImportIcon = make(Import, 18);
export const SettingsIcon = make(Settings, 20);
export const GithubIcon = make(Github, 16);
export const TrashIcon = make(Trash2, 16);
