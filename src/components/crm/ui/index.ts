/* Single import surface for the CRM kit. Pages import from here, never
   from the individual files, so a primitive can be split or renamed
   without touching a page. */
export { Button, ButtonLink, IconButton } from './Button';
export type { ButtonVariant, ButtonSize } from './Button';

export { Badge, Dot, PROJECT_STATUS_TONE, PROJECT_STATUS_LABEL } from './Badge';
export type { Tone } from './Badge';

export { Avatar, AvatarStack } from './Avatar';
export { Mark } from './Mark';
export { Card, CardHeader, Label, Stat } from './Card';
export { Skeleton, SkeletonRows, SkeletonTiles, Spinner, EmptyState, ErrorState } from './Feedback';
export { Field, Input, Textarea, Select, SearchInput } from './Field';
export { SegmentedControl } from './SegmentedControl';
export { Dialog } from './Dialog';
export { Drawer } from './Drawer';
export { Menu } from './Menu';
export type { MenuItem } from './Menu';
export { ToastProvider, useToast } from './Toast';
export { PageHeader } from './PageHeader';
export { TableShell, Th, Td, Tr } from './Table';
