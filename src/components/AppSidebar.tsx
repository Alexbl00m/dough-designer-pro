import { BookOpen, ChefHat, ListChecks, Settings2, Sliders } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from '@/components/ui/sidebar';
import { useT } from '@/i18n';
import { cn } from '@/lib/utils';

export type Section = 'styles' | 'parameters' | 'recipe';

interface AppSidebarProps {
  currentSection: Section;
  onSectionChange: (section: Section) => void;
  /** Parameters and recipe only make sense once a style is chosen. */
  hasStyle: boolean;
  styleName?: string;
}

const SECTIONS: { id: Section; labelKey: string; icon: typeof Sliders }[] = [
  { id: 'styles', labelKey: 'nav.styles', icon: BookOpen },
  { id: 'parameters', labelKey: 'nav.parameters', icon: Sliders },
  { id: 'recipe', labelKey: 'nav.recipe', icon: ListChecks },
];

export function AppSidebar({
  currentSection,
  onSectionChange,
  hasStyle,
  styleName,
}: AppSidebarProps) {
  const { state } = useSidebar();
  const t = useT();
  const collapsed = state === 'collapsed';

  return (
    <Sidebar collapsible="icon" className="no-print">
      <SidebarContent>
        <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
          <ChefHat className="h-5 w-5 shrink-0 text-primary" aria-hidden />
          {!collapsed && <span className="truncate font-semibold">{t('app.name')}</span>}
        </div>

        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>{t('recipe.title')}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS.map(({ id, labelKey, icon: Icon }, index) => {
                const disabled = id !== 'styles' && !hasStyle;
                const active = currentSection === id;
                return (
                  <SidebarMenuItem key={id}>
                    <SidebarMenuButton
                      onClick={() => !disabled && onSectionChange(id)}
                      disabled={disabled}
                      aria-current={active ? 'step' : undefined}
                      tooltip={t(labelKey)}
                      className={cn(
                        active && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
                        disabled && 'cursor-not-allowed opacity-40',
                      )}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      {!collapsed && (
                        <span className="flex-1 truncate text-left">{t(labelKey)}</span>
                      )}
                      {!collapsed && (
                        <span className="text-xs tabular text-muted-foreground">{index + 1}</span>
                      )}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {hasStyle && styleName && !collapsed && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('styles.selected')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <p className="px-2 text-sm font-medium leading-snug text-sidebar-foreground">
                {styleName}
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton asChild tooltip={t('nav.saved')}>
                  <NavLink to="/saved">
                    <Settings2 className="h-4 w-4" aria-hidden />
                    {!collapsed && <span>{t('nav.saved')}</span>}
                  </NavLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
