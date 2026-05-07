import { useState } from 'react';
import { Plus, Trash2, FolderOpen } from 'lucide-react';

export default function WorkspaceManager({ 
  workspaces, 
  activeWorkspaceId, 
  onSwitchWorkspace, 
  onCreateWorkspace, 
  onDeleteWorkspace 
}) {
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workspaceName, setWorkspaceName] = useState('');

  const handleCreateWorkspace = () => {
    if (workspaceName.trim()) {
      onCreateWorkspace(workspaceName.trim());
      setWorkspaceName('');
      setShowCreateModal(false);
    }
  };

  const handleDeleteWorkspace = (workspaceId) => {
    if (workspaces.length > 1) {
      onDeleteWorkspace(workspaceId);
    }
  };

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);

  return (
    <div className="flex items-center gap-2">
      {/* Workspace Tabs */}
      <div className="flex items-center gap-1">
        {workspaces.map((workspace) => (
          <div key={workspace.id} className="relative group">
            <button
              onClick={() => onSwitchWorkspace(workspace.id)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition ${
                activeWorkspaceId === workspace.id
                  ? 'bg-teal-500 text-white'
                  : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              <FolderOpen size={14} />
              <span>{workspace.name}</span>
              {activeWorkspace && activeWorkspace.id === workspace.id && (
                <span className="text-xs bg-teal-600 px-1.5 py-0.5 rounded">Active</span>
              )}
            </button>
            
            {/* Delete Button for Non-Active Workspaces */}
            {workspace.id !== activeWorkspaceId && workspaces.length > 1 && (
              <button
                onClick={() => handleDeleteWorkspace(workspace.id)}
                className="absolute -top-2 -right-2 p-1 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="Delete Workspace"
              >
                <Trash2 size={10} />
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Create New Workspace Button */}
      <button
        onClick={() => setShowCreateModal(true)}
        className="flex items-center justify-center w-8 h-8 rounded-full bg-teal-500 text-white hover:bg-teal-600 transition"
        title="Create New Workspace"
      >
        <Plus size={16} />
      </button>

      {/* Create Workspace Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-lg p-6 w-96 border border-slate-600">
            <h3 className="text-lg font-semibold text-white mb-4">Create New Workspace</h3>
            <input
              type="text"
              value={workspaceName}
              onChange={(e) => setWorkspaceName(e.target.value)}
              placeholder="Workspace name"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-md text-white placeholder-slate-400 focus:outline-none focus:border-teal-500"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreateWorkspace();
                if (e.key === 'Escape') setShowCreateModal(false);
              }}
            />
            <div className="flex justify-end gap-2 mt-4">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 bg-slate-700 text-slate-300 rounded-md hover:bg-slate-600 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateWorkspace}
                disabled={!workspaceName.trim()}
                className="px-4 py-2 bg-teal-500 text-white rounded-md hover:bg-teal-600 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
