// Minimal inline icon set — stroke-based, sized via `size`. Dependency-free.
type P = { size?: number; className?: string };
const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
});

export const DrawIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 16.5 14.5 6a2 2 0 0 1 3 3L7 19.5 3 21l1.5-4Z" />
    <path d="M12.5 7.5 16 11" />
  </svg>
);
export const MindIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="9" y="3" width="6" height="4" rx="1.2" />
    <rect x="3" y="17" width="6" height="4" rx="1.2" />
    <rect x="15" y="17" width="6" height="4" rx="1.2" />
    <path d="M12 7v4M12 11c0 2-3 2-6 2.5M12 11c0 2 3 2 6 2.5M6 13.5V17M18 13.5V17" />
  </svg>
);
export const DocIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M7 3h7l5 5v13a0 0 0 0 1 0 0H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
    <path d="M14 3v5h5M9 13h6M9 17h6" />
  </svg>
);
export const KanbanIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="5" height="16" rx="1.2" />
    <rect x="10" y="4" width="5" height="10" rx="1.2" />
    <rect x="17" y="4" width="4" height="13" rx="1.2" />
  </svg>
);
export const PlusIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M12 5v14M5 12h14" />
  </svg>
);
export const SearchIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
export const ChevronIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m6 9 6 6 6-6" />
  </svg>
);
export const ChevronRightIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="m9 6 6 6-6 6" />
  </svg>
);
export const CheckIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
export const SunIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.5 1.5M17.5 17.5 19 19M19 5l-1.5 1.5M6.5 17.5 5 19" />
  </svg>
);
export const MoonIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M21 12.8A8 8 0 1 1 11.2 3a6 6 0 0 0 9.8 9.8Z" />
  </svg>
);
export const ShareIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
    <path d="M12 15V3M8 7l4-4 4 4" />
  </svg>
);
export const TrashIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" />
  </svg>
);
export const PanelIcon = ({ size = 16, className }: P) => (
  <svg {...base(size)} className={className}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M15 4v16" />
  </svg>
);
