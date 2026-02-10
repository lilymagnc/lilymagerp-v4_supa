import { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  icon?: LucideIcon;
  children?: React.ReactNode;
}

export function PageHeader({ title, description, icon: Icon, children }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between mb-6">
      <div className="grid gap-1">
        <div className="flex items-center gap-2">
          {Icon && <Icon className="h-8 w-8 text-primary" />}
          <h1 className="text-2xl md:text-3xl font-bold font-headline tracking-tight">{title}</h1>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}
