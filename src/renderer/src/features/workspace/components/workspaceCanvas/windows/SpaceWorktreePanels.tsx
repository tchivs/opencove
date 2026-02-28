import React from 'react'
import type { GitWorktreeInfo } from '@shared/types/api'
import type { WorkspaceSpaceState } from '../../../types'
import type { BranchMode, SpaceWorktreeViewMode } from './spaceWorktree.shared'

export function SpaceWorktreePanels({
  space,
  viewMode,
  isBusy,
  isMutating,
  isSuggesting,
  isSpaceOnWorkspaceRoot,
  branches,
  currentBranch,
  worktrees,
  selectedWorktreePath,
  branchMode,
  newBranchName,
  startPoint,
  existingBranchName,
  worktreeName,
  worktreePathPreview,
  spaceNotes,
  removeWorktreeOnDetach,
  removeConfirmText,
  resolvedWorktreesRoot,
  workspacePath,
  onOpenSwitch,
  onOpenCreate,
  onOpenDetach,
  onBackHome,
  onBackDetach,
  onSelectWorktreePath,
  onRefresh,
  onBind,
  onBranchModeChange,
  onNewBranchNameChange,
  onStartPointChange,
  onExistingBranchNameChange,
  onWorktreeNameChange,
  onSpaceNotesChange,
  onSuggestNames,
  onCreate,
  onRemoveWorktreeOnDetachChange,
  onDetachContinue,
  onRemoveConfirmTextChange,
  onDetachRemoveConfirm,
}: {
  space: WorkspaceSpaceState
  viewMode: SpaceWorktreeViewMode
  isBusy: boolean
  isMutating: boolean
  isSuggesting: boolean
  isSpaceOnWorkspaceRoot: boolean
  branches: string[]
  currentBranch: string | null
  worktrees: GitWorktreeInfo[]
  selectedWorktreePath: string
  branchMode: BranchMode
  newBranchName: string
  startPoint: string
  existingBranchName: string
  worktreeName: string
  worktreePathPreview: string
  spaceNotes: string
  removeWorktreeOnDetach: boolean
  removeConfirmText: string
  resolvedWorktreesRoot: string
  workspacePath: string
  onOpenSwitch: () => void
  onOpenCreate: () => void
  onOpenDetach: () => void
  onBackHome: () => void
  onBackDetach: () => void
  onSelectWorktreePath: (path: string) => void
  onRefresh: () => void
  onBind: () => void
  onBranchModeChange: (mode: BranchMode) => void
  onNewBranchNameChange: (value: string) => void
  onStartPointChange: (value: string) => void
  onExistingBranchNameChange: (value: string) => void
  onWorktreeNameChange: (value: string) => void
  onSpaceNotesChange: (value: string) => void
  onSuggestNames: () => void
  onCreate: () => void
  onRemoveWorktreeOnDetachChange: (checked: boolean) => void
  onDetachContinue: () => void
  onRemoveConfirmTextChange: (value: string) => void
  onDetachRemoveConfirm: () => void
}): React.JSX.Element {
  return (
    <>
      {viewMode === 'home' ? (
        <div className="workspace-space-worktree__view" data-testid="space-worktree-home-view">
          <section className="workspace-space-worktree__surface workspace-space-worktree__surface--actions">
            <h4>What do you want to do?</h4>
            <div
              className={`workspace-space-worktree__action-grid${
                isSpaceOnWorkspaceRoot ? '' : ' workspace-space-worktree__action-grid--two'
              }`}
            >
              <button
                type="button"
                className="workspace-space-worktree__action-card"
                data-testid="space-worktree-open-switch"
                disabled={isBusy}
                onClick={onOpenSwitch}
              >
                <span className="workspace-space-worktree__action-title">Switch</span>
                <span className="workspace-space-worktree__action-description">
                  {isSpaceOnWorkspaceRoot
                    ? 'Bind this Space to an existing worktree.'
                    : 'Switch this Space to another existing worktree.'}
                </span>
              </button>

              {isSpaceOnWorkspaceRoot ? (
                <button
                  type="button"
                  className="workspace-space-worktree__action-card"
                  data-testid="space-worktree-open-create"
                  disabled={isBusy}
                  onClick={onOpenCreate}
                >
                  <span className="workspace-space-worktree__action-title">Create</span>
                  <span className="workspace-space-worktree__action-description">
                    Create and bind a fresh worktree for this Space.
                  </span>
                </button>
              ) : null}

              <button
                type="button"
                className="workspace-space-worktree__action-card workspace-space-worktree__action-card--danger"
                data-testid="space-worktree-open-detach"
                disabled={isBusy}
                onClick={onOpenDetach}
              >
                <span className="workspace-space-worktree__action-title">Detach</span>
                <span className="workspace-space-worktree__action-description">
                  Move this Space back to workspace root.
                </span>
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {viewMode === 'switch' ? (
        <div className="workspace-space-worktree__view" data-testid="space-worktree-switch-view">
          <div className="workspace-space-worktree__view-header">
            <button
              type="button"
              className="cove-window__action cove-window__action--ghost"
              data-testid="space-worktree-back-home"
              disabled={isBusy}
              onClick={onBackHome}
            >
              ← Back
            </button>
            <h4>Switch to existing worktree</h4>
          </div>

          <section className="workspace-space-worktree__surface">
            <div className="cove-window__field-row">
              <label htmlFor="space-worktree-bind-select">Worktree</label>
              <select
                id="space-worktree-bind-select"
                data-testid="space-worktree-bind-select"
                value={selectedWorktreePath}
                disabled={isBusy}
                onChange={event => {
                  onSelectWorktreePath(event.target.value)
                }}
              >
                {worktrees.map(entry => (
                  <option value={entry.path} key={entry.path}>
                    {entry.branch ? `${entry.branch} · ${entry.path}` : entry.path}
                  </option>
                ))}
              </select>
            </div>

            {worktrees.length === 0 ? (
              <p className="workspace-space-worktree__hint">
                No worktree detected. Create one first.
              </p>
            ) : null}

            <div className="workspace-space-worktree__inline-actions">
              <button
                type="button"
                className="cove-window__action cove-window__action--secondary"
                data-testid="space-worktree-refresh"
                disabled={isBusy}
                onClick={onRefresh}
              >
                Refresh
              </button>
              <button
                type="button"
                className="cove-window__action cove-window__action--primary"
                data-testid="space-worktree-bind"
                disabled={isBusy || worktrees.length === 0}
                onClick={onBind}
              >
                Switch
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {viewMode === 'create' ? (
        <div className="workspace-space-worktree__view" data-testid="space-worktree-create-view">
          <div className="workspace-space-worktree__view-header">
            <button
              type="button"
              className="cove-window__action cove-window__action--ghost"
              data-testid="space-worktree-back-home"
              disabled={isBusy}
              onClick={onBackHome}
            >
              ← Back
            </button>
            <h4>Create and bind worktree</h4>
          </div>

          <section className="workspace-space-worktree__surface">
            <p className="workspace-space-worktree__hint">
              Worktree root: <strong>{resolvedWorktreesRoot}</strong>
            </p>

            <div className="cove-window__field-row">
              <label>Branch mode</label>
              <div className="workspace-space-worktree__radio-row">
                <label>
                  <input
                    type="radio"
                    name="space-worktree-branch-mode"
                    checked={branchMode === 'new'}
                    disabled={isBusy}
                    onChange={() => {
                      onBranchModeChange('new')
                    }}
                  />
                  New branch
                </label>
                <label>
                  <input
                    type="radio"
                    name="space-worktree-branch-mode"
                    checked={branchMode === 'existing'}
                    disabled={isBusy}
                    onChange={() => {
                      onBranchModeChange('existing')
                    }}
                  />
                  Existing branch
                </label>
              </div>
            </div>

            {branchMode === 'new' ? (
              <>
                <div className="cove-window__field-row">
                  <label htmlFor="space-worktree-branch-name">Branch name</label>
                  <input
                    id="space-worktree-branch-name"
                    data-testid="space-worktree-branch-name"
                    value={newBranchName}
                    disabled={isBusy}
                    placeholder="e.g. space/infra-core"
                    onChange={event => {
                      onNewBranchNameChange(event.target.value)
                    }}
                  />
                </div>

                <div className="cove-window__field-row">
                  <label htmlFor="space-worktree-start-point">Start from</label>
                  <select
                    id="space-worktree-start-point"
                    data-testid="space-worktree-start-point"
                    value={startPoint}
                    disabled={isBusy}
                    onChange={event => {
                      onStartPointChange(event.target.value)
                    }}
                  >
                    <option value="HEAD">HEAD</option>
                    {currentBranch ? <option value={currentBranch}>{currentBranch}</option> : null}
                    {branches
                      .filter(branch => branch !== currentBranch)
                      .map(branch => (
                        <option value={branch} key={branch}>
                          {branch}
                        </option>
                      ))}
                  </select>
                </div>
              </>
            ) : (
              <div className="cove-window__field-row">
                <label htmlFor="space-worktree-existing-branch">Branch</label>
                <select
                  id="space-worktree-existing-branch"
                  data-testid="space-worktree-existing-branch"
                  value={existingBranchName}
                  disabled={isBusy}
                  onChange={event => {
                    onExistingBranchNameChange(event.target.value)
                  }}
                >
                  {branches.map(branch => (
                    <option value={branch} key={branch}>
                      {branch}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="cove-window__field-row">
              <label htmlFor="space-worktree-name">Worktree name</label>
              <input
                id="space-worktree-name"
                data-testid="space-worktree-name"
                value={worktreeName}
                disabled={isBusy}
                placeholder="e.g. infra-core"
                onChange={event => {
                  onWorktreeNameChange(event.target.value)
                }}
              />
              <span className="workspace-space-worktree__hint" data-testid="space-worktree-preview">
                Path: {worktreePathPreview}
              </span>
            </div>

            <div className="cove-window__field-row">
              <label htmlFor="space-worktree-notes">Naming requirements (optional)</label>
              <textarea
                id="space-worktree-notes"
                data-testid="space-worktree-notes"
                value={spaceNotes}
                disabled={isBusy}
                placeholder="e.g. include ticket id, keep short, etc."
                onChange={event => {
                  onSpaceNotesChange(event.target.value)
                }}
              />
            </div>

            <div className="workspace-space-worktree__inline-actions">
              <button
                type="button"
                className="cove-window__action cove-window__action--secondary"
                data-testid="space-worktree-suggest-ai"
                disabled={isBusy}
                onClick={onSuggestNames}
              >
                {isSuggesting ? 'Generating...' : 'Generate by AI'}
              </button>
              <button
                type="button"
                className="cove-window__action cove-window__action--primary"
                data-testid="space-worktree-create"
                disabled={isBusy}
                onClick={onCreate}
              >
                {isMutating ? 'Creating...' : 'Create & Bind'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {viewMode === 'detach' ? (
        <div className="workspace-space-worktree__view" data-testid="space-worktree-detach-view">
          <div className="workspace-space-worktree__view-header">
            <button
              type="button"
              className="cove-window__action cove-window__action--ghost"
              data-testid="space-worktree-back-home"
              disabled={isBusy}
              onClick={onBackHome}
            >
              ← Back
            </button>
            <h4>Detach from worktree</h4>
          </div>

          <section className="workspace-space-worktree__surface workspace-space-worktree__surface--danger">
            <p>
              This will rebind <strong>{space.name}</strong> to workspace root:
            </p>
            <p className="workspace-space-worktree__danger-path">{workspacePath}</p>

            {!isSpaceOnWorkspaceRoot ? (
              <label className="workspace-space-worktree__checkbox">
                <input
                  type="checkbox"
                  data-testid="space-worktree-detach-remove"
                  checked={removeWorktreeOnDetach}
                  disabled={isBusy}
                  onChange={event => {
                    onRemoveWorktreeOnDetachChange(event.target.checked)
                  }}
                />
                Also remove current worktree directory from Git metadata
              </label>
            ) : null}

            {isSpaceOnWorkspaceRoot ? (
              <p className="workspace-space-worktree__hint">
                This Space is already on workspace root.
              </p>
            ) : null}

            <div className="workspace-space-worktree__inline-actions">
              <button
                type="button"
                className="cove-window__action cove-window__action--primary"
                data-testid="space-worktree-detach-continue"
                disabled={isBusy}
                onClick={onDetachContinue}
              >
                Continue
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {viewMode === 'detach-confirm' ? (
        <div
          className="workspace-space-worktree__view"
          data-testid="space-worktree-detach-confirm-view"
        >
          <div className="workspace-space-worktree__view-header">
            <button
              type="button"
              className="cove-window__action cove-window__action--ghost"
              data-testid="space-worktree-back-home"
              disabled={isBusy}
              onClick={onBackDetach}
            >
              ← Back
            </button>
            <h4>Confirm remove worktree</h4>
          </div>

          <section className="workspace-space-worktree__surface workspace-space-worktree__surface--danger">
            <p>
              This will remove worktree:
              <br />
              <strong>{space.directoryPath}</strong>
            </p>
            <p className="workspace-space-worktree__hint">
              Type <strong>REMOVE</strong> to confirm.
            </p>

            <div className="cove-window__field-row">
              <label htmlFor="space-worktree-remove-confirm-input">Confirmation</label>
              <input
                id="space-worktree-remove-confirm-input"
                data-testid="space-worktree-remove-confirm-input"
                value={removeConfirmText}
                disabled={isBusy}
                onChange={event => {
                  onRemoveConfirmTextChange(event.target.value)
                }}
              />
            </div>

            <div className="workspace-space-worktree__inline-actions">
              <button
                type="button"
                className="cove-window__action cove-window__action--danger"
                data-testid="space-worktree-remove-confirm-submit"
                disabled={isBusy || removeConfirmText !== 'REMOVE'}
                onClick={onDetachRemoveConfirm}
              >
                {isMutating ? 'Removing...' : 'Detach & Remove'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  )
}
