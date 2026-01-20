import { useState, useEffect } from 'react';

interface Branch {
  name: string;
  displayName: string;
  url: string;
  isMain: boolean;
}

interface Technique {
  id: string;
  name: string;
  branches: Branch[];
  isLoading: boolean;
}

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  repoOwner: string;
  repoName: string;
}

// Display branch name as-is
function getDisplayName(branchName: string): string {
  return branchName;
}

// Get the deployed URL for a branch
function getBranchUrl(repoOwner: string, repoName: string, branchName: string): string {
  if (branchName === 'main' || branchName === 'master') {
    return `https://${repoOwner}.github.io/${repoName}/`;
  }
  // For feature branches - adjust based on your deployment strategy
  return `https://${repoOwner}.github.io/${repoName}/?branch=${encodeURIComponent(branchName)}`;
}

export function Sidebar({ isOpen, onClose, repoOwner, repoName }: SidebarProps) {
  const [techniques, setTechniques] = useState<Technique[]>([
    { id: 'flow-lines', name: 'Flow Lines', branches: [], isLoading: true },
  ]);
  const [expandedTechnique, setExpandedTechnique] = useState<string | null>('flow-lines');
  const [error, setError] = useState<string | null>(null);

  // Fetch branches from GitHub API
  useEffect(() => {
    if (!isOpen) return;

    async function fetchBranches() {
      try {
        const response = await fetch(
          `https://api.github.com/repos/${repoOwner}/${repoName}/branches?per_page=100`
        );

        if (!response.ok) {
          throw new Error(`GitHub API error: ${response.status}`);
        }

        const apiBranches: { name: string }[] = await response.json();

        // Convert to our Branch format
        const allBranches: Branch[] = apiBranches.map(b => ({
          name: b.name,
          displayName: b.name === 'main' || b.name === 'master'
            ? `main`
            : getDisplayName(b.name),
          url: getBranchUrl(repoOwner, repoName, b.name),
          isMain: b.name === 'main' || b.name === 'master',
        }));

        // Sort: main first, then alphabetically by display name
        allBranches.sort((a, b) => {
          if (a.isMain && !b.isMain) return -1;
          if (!a.isMain && b.isMain) return 1;
          return a.displayName.localeCompare(b.displayName);
        });

        // For now, all branches go under "Flow Lines" since it's the only technique
        // In the future, we could parse branch names to categorize by technique
        setTechniques(prev => prev.map(t => ({
          ...t,
          branches: allBranches,
          isLoading: false,
        })));

        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch branches');
        setTechniques(prev => prev.map(t => ({ ...t, isLoading: false })));
      }
    }

    fetchBranches();
  }, [isOpen, repoOwner, repoName]);

  const toggleTechnique = (id: string) => {
    setExpandedTechnique(expandedTechnique === id ? null : id);
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={`sidebar-backdrop ${isOpen ? 'open' : ''}`}
        onClick={onClose}
      />

      {/* Sidebar panel */}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <header className="sidebar-header">
          <h2>Techniques</h2>
          <button className="sidebar-close" onClick={onClose} aria-label="Close sidebar">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
        </header>

        <nav className="sidebar-nav">
          {error && (
            <div className="sidebar-error">
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {techniques.map(technique => (
            <div key={technique.id} className="technique-group">
              <button
                className={`technique-header ${expandedTechnique === technique.id ? 'expanded' : ''}`}
                onClick={() => toggleTechnique(technique.id)}
              >
                <span className="technique-name">{technique.name}</span>
                <svg
                  className="technique-chevron"
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                >
                  <path
                    d="M3 4.5L6 7.5L9 4.5"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                </svg>
              </button>

              <div className={`technique-branches ${expandedTechnique === technique.id ? 'expanded' : ''}`}>
                {technique.isLoading ? (
                  <div className="branch-loading">Loading branches...</div>
                ) : technique.branches.length === 0 ? (
                  <div className="branch-empty">No branches found</div>
                ) : (
                  technique.branches.map(branch => (
                    <a
                      key={branch.name}
                      href={branch.url}
                      className={`branch-link ${branch.isMain ? 'main-branch' : ''}`}
                      title={branch.name}
                    >
                      <span className="branch-icon">
                        {branch.isMain ? '●' : '○'}
                      </span>
                      <span className="branch-name">
                        {branch.displayName}
                      </span>
                    </a>
                  ))
                )}
              </div>
            </div>
          ))}
        </nav>

        <footer className="sidebar-footer">
          <a
            href={`https://github.com/${repoOwner}/${repoName}`}
            target="_blank"
            rel="noopener noreferrer"
            className="github-link"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            <span>View on GitHub</span>
          </a>
        </footer>
      </aside>
    </>
  );
}
