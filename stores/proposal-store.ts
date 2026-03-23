import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  Proposal,
  ChangeRecord,
  ProposalStatus,
  EntityType,
  ChangeType,
} from '@/lib/types/ontology';
import { generateId } from '@/lib/utils';

interface ProposalStore {
  proposals: Proposal[];
  activeProposalId: string | null;

  // Proposal Actions
  createProposal: (title: string, description: string, changes: ChangeRecord[]) => Proposal;
  submitProposal: (id: string) => void;
  approveProposal: (id: string, comment?: string) => void;
  rejectProposal: (id: string, comment: string) => void;
  deleteProposal: (id: string) => void;
  setActiveProposal: (id: string | null) => void;

  // Helper Actions
  addChange: (proposalId: string, change: Omit<ChangeRecord, 'id'>) => void;
  removeChange: (proposalId: string, changeId: string) => void;
  
  // Getters
  getProposal: (id: string) => Proposal | undefined;
  getPendingProposals: () => Proposal[];
  getProposalCount: () => { pending: number; approved: number; rejected: number };
}

export const useProposalStore = create<ProposalStore>()(
  persist(
    (set, get) => ({
      proposals: [],
      activeProposalId: null,

      createProposal: (title, description, changes) => {
        const newProposal: Proposal = {
          id: generateId(),
          title,
          description,
          status: 'DRAFT',
          changes,
          createdBy: 'current-user',
          createdAt: new Date().toISOString(),
        };
        set((state) => ({
          proposals: [...state.proposals, newProposal],
        }));
        return newProposal;
      },

      submitProposal: (id) => {
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === id ? { ...p, status: 'PENDING' as ProposalStatus } : p
          ),
        }));
      },

      approveProposal: (id, comment) => {
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'APPROVED' as ProposalStatus,
                  reviewedBy: 'reviewer',
                  reviewedAt: new Date().toISOString(),
                  reviewComment: comment,
                }
              : p
          ),
        }));
      },

      rejectProposal: (id, comment) => {
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === id
              ? {
                  ...p,
                  status: 'REJECTED' as ProposalStatus,
                  reviewedBy: 'reviewer',
                  reviewedAt: new Date().toISOString(),
                  reviewComment: comment,
                }
              : p
          ),
        }));
      },

      deleteProposal: (id) => {
        set((state) => ({
          proposals: state.proposals.filter((p) => p.id !== id),
          activeProposalId: state.activeProposalId === id ? null : state.activeProposalId,
        }));
      },

      setActiveProposal: (id) => {
        set({ activeProposalId: id });
      },

      addChange: (proposalId, change) => {
        const changeRecord: ChangeRecord = {
          ...change,
          id: generateId(),
        };
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === proposalId
              ? { ...p, changes: [...p.changes, changeRecord] }
              : p
          ),
        }));
      },

      removeChange: (proposalId, changeId) => {
        set((state) => ({
          proposals: state.proposals.map((p) =>
            p.id === proposalId
              ? { ...p, changes: p.changes.filter((c) => c.id !== changeId) }
              : p
          ),
        }));
      },

      getProposal: (id) => {
        return get().proposals.find((p) => p.id === id);
      },

      getPendingProposals: () => {
        return get().proposals.filter((p) => p.status === 'PENDING');
      },

      getProposalCount: () => {
        const proposals = get().proposals;
        return {
          pending: proposals.filter((p) => p.status === 'PENDING').length,
          approved: proposals.filter((p) => p.status === 'APPROVED').length,
          rejected: proposals.filter((p) => p.status === 'REJECTED').length,
        };
      },
    }),
    {
      name: 'proposal-storage',
      partialize: (state) => ({
        proposals: state.proposals,
      }),
    }
  )
);
