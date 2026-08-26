import { ChefHat, Calculator, Settings, BookOpen } from "lucide-react";
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
} from "@/components/ui/sidebar";

interface AppSidebarProps {
  selectedStyle: string | null;
  onSectionChange: (section: 'styles' | 'calculator' | 'results') => void;
  currentSection: 'styles' | 'calculator' | 'results';
}

export function AppSidebar({ selectedStyle, onSectionChange, currentSection }: AppSidebarProps) {
  const { state } = useSidebar();
  const isCollapsed = state === 'collapsed';

  return (
    <Sidebar className={isCollapsed ? "w-14" : "w-64"} collapsible="icon">
      <SidebarContent>
        <div className="p-4 border-b">
          <div className="flex items-center gap-2">
            <ChefHat className="h-6 w-6 text-primary" />
            {!isCollapsed && <span className="font-semibold">Baker's Calculator</span>}
          </div>
        </div>

        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={() => onSectionChange('styles')}
                  className={currentSection === 'styles' ? 'bg-muted text-primary font-medium' : ''}
                >
                  <BookOpen className="h-4 w-4" />
                  {!isCollapsed && <span>Välj Stil</span>}
                </SidebarMenuButton>
              </SidebarMenuItem>
              
              {selectedStyle && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => onSectionChange('calculator')}
                      className={currentSection === 'calculator' ? 'bg-muted text-primary font-medium' : ''}
                    >
                      <Settings className="h-4 w-4" />
                      {!isCollapsed && <span>Parametrar</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  
                  <SidebarMenuItem>
                    <SidebarMenuButton 
                      onClick={() => onSectionChange('results')}
                      className={currentSection === 'results' ? 'bg-muted text-primary font-medium' : ''}
                    >
                      <Calculator className="h-4 w-4" />
                      {!isCollapsed && <span>Recept</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}