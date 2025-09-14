import React from 'react';
import { Folder, ChevronDown } from 'lucide-react';
import { Project } from '../../types';

interface ProjectSwitcherProps {
  currentProject: Project;
  projects: Project[];
  onSwitch: (project: Project) => void;
}

const ProjectSwitcher: React.FC<ProjectSwitcherProps> = ({ 
  currentProject, 
  projects, 
  onSwitch 
}) => {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <div className="terminal-window">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Folder className="text-terminal-blue" size={20} />
          <span className="text-sm text-gray-500">Current Project:</span>
          <span className="font-medium">{currentProject.name}</span>
        </div>

        <div className="relative">
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="flex items-center gap-2 px-3 py-1 bg-terminal-border rounded-lg hover:bg-terminal-blue transition-colors"
          >
            <span className="text-sm">Switch Project</span>
            <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-terminal-surface border border-terminal-border rounded-lg shadow-lg z-10">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => {
                    onSwitch(project);
                    setIsOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 hover:bg-terminal-border transition-colors ${
                    project.id === currentProject.id ? 'bg-terminal-border' : ''
                  }`}
                >
                  <div className="font-medium">{project.name}</div>
                  <div className="text-xs text-gray-500 mt-1">{project.path}</div>
                  {project.lastCommand && (
                    <div className="text-xs text-terminal-blue mt-1">
                      Last: {project.lastCommand}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 text-xs text-gray-500">
        Say "Switch to [project name]" to change context via voice
      </div>
    </div>
  );
};

export default ProjectSwitcher;