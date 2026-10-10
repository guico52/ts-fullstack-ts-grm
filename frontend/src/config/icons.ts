/**
 * The icon catalogue the view form offers.
 *
 * A **curated** list, not `import * as icons from "@lucide/vue"`: a
 * namespace import defeats tree-shaking and pulls the entire library into
 * the bundle (thousands of icons, well over a megabyte) for a picker that
 * shows a few dozen. Every entry here costs bytes, and every entry the user
 * sees is one they might actually use.
 *
 * Two things this file is responsible for:
 *
 * - **Adding an icon** is one import and one entry. No component changes.
 * - **Swapping libraries** means rewriting this file only — nothing else
 *   knows which package the icons come from, because everything downstream
 *   works from `ICON_GROUPS` and a `Component`.
 */
import type { Component } from "vue"
import {
  Activity,
  AlertTriangle,
  Archive,
  ArrowLeftRight,
  BarChart3,
  Bell,
  BookOpen,
  Boxes,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Cloud,
  Code2,
  Cog,
  Compass,
  CreditCard,
  Database,
  Download,
  Eye,
  FileText,
  Filter,
  Flag,
  Folder,
  Gauge,
  Globe,
  Grid2x2,
  Hash,
  Heart,
  Home,
  Image,
  Info,
  KeyRound,
  Layers,
  LayoutDashboard,
  LayoutList,
  Link2,
  ListChecks,
  Lock,
  Mail,
  Megaphone,
  Menu,
  MessageSquare,
  Monitor,
  Moon,
  Navigation,
  Package,
  Palette,
  PieChart,
  Puzzle,
  ReceiptText,
  RefreshCw,
  Rocket,
  Search,
  Server,
  Settings,
  Share2,
  Shield,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Star,
  Sun,
  Table,
  Tag,
  Terminal,
  TrendingUp,
  Upload,
  UserCheck,
  UserCog,
  Users,
  Wand2,
  Wrench,
  XCircle,
  Zap,
} from "@lucide/vue"

export interface IconGroup {
  label: string
  icons: Record<string, Component>
}

/** Look an icon up by the name stored in the database, if it is in the catalogue. */
export function findIcon(name: string | null | undefined): Component | undefined {
  if (typeof name !== "string" || name === "") return undefined
  for (const group of ICON_GROUPS) {
    const icon = group.icons[name]
    if (icon) return icon
  }
  return undefined
}

export const ICON_GROUPS: readonly IconGroup[] = [
  {
    label: "导航与布局",
    icons: {
      LayoutDashboard,
      LayoutList,
      Menu,
      Navigation,
      Compass,
      Grid2x2,
      Home,
      Table,
      Layers,
    },
  },
  {
    label: "系统与安全",
    icons: {
      Shield,
      ShieldCheck,
      Lock,
      KeyRound,
      UserCog,
      Users,
      UserCheck,
      Server,
      Database,
      Terminal,
      Code2,
      Monitor,
    },
  },
  {
    label: "组织与业务",
    icons: {
      Building2,
      Briefcase,
      Package,
      Boxes,
      ReceiptText,
      CreditCard,
      ClipboardList,
      ListChecks,
      Tag,
      Archive,
      Megaphone,
      Rocket,
    },
  },
  {
    label: "数据与图表",
    icons: {
      BarChart3,
      PieChart,
      TrendingUp,
      Gauge,
      Activity,
      Hash,
      Filter,
      Search,
      SlidersHorizontal,
    },
  },
  {
    label: "文件与时间",
    icons: {
      FileText,
      Folder,
      BookOpen,
      Image,
      Upload,
      Download,
      Calendar,
      Clock,
      Bell,
      Mail,
      Cloud,
      Globe,
    },
  },
  {
    label: "状态与操作",
    icons: {
      CheckCircle2,
      XCircle,
      AlertTriangle,
      Info,
      Star,
      Heart,
      Flag,
      RefreshCw,
      Link2,
      Share2,
      ArrowLeftRight,
      Eye,
    },
  },
  {
    label: "外观与设置",
    icons: {
      Palette,
      Sparkles,
      Wand2,
      Sun,
      Moon,
      Settings,
      Cog,
      Wrench,
      Puzzle,
      Zap,
      MessageSquare,
    },
  },
]
