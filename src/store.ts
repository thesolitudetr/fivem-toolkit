import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/core';

export interface ScannedFile {
  name: string;
  path: string;
  relative_path: string;
  size: number;
  category: string;
}

export interface FiveMResource {
  name: string;
  path: string;
  has_manifest: boolean;
  manifest_type: 'fxmanifest' | 'resource' | 'none';
  manifest_content: string;
  files: ScannedFile[];
  total_size: number;
  stream_size: number;
  meta_files: string[];
}

export interface AnalyzerWarning {
  file_name: string;
  relative_path: string;
  file_size: number;
  threshold: number;
  severity: 'info' | 'warning' | 'critical';
  message: string;
}

export interface StreamAnalysisReport {
  resource_name: string;
  path: string;
  total_files: number;
  total_size: number;
  stream_size: number;
  warnings: AnalyzerWarning[];
  category_sizes: Record<string, number>;
  category_counts: Record<string, number>;
}

export interface MergeVehicleInfo {
  name: string;
  model_names: string[];
  handling_ids: string[];
  stream_files: string[];
  meta_files: string[];
  warnings: string[];
}

export interface MergePreview {
  vehicles: MergeVehicleInfo[];
  stream_conflicts: string[];
  model_conflicts: string[];
  handling_conflicts: string[];
  can_merge: boolean;
}

export interface MetaIssue {
  id: string;
  issue_type: string;
  file_name: string;
  relative_path: string;
  severity: 'warning' | 'critical';
  description: string;
  proposed_fix: string;
}

export interface ValidationResult {
  path: string;
  is_valid: boolean;
  issues: MetaIssue[];
}

export interface DependencyInfo {
  name: string;
  is_optional: boolean;
  is_missing_locally: boolean;
}

export interface DependencyScanReport {
  resource_name: string;
  path: string;
  declared_dependencies: DependencyInfo[];
  legacy_warnings: string[];
}

export interface RecentActivity {
  id: string;
  activity_type: 'scan' | 'merge' | 'fix' | 'export';
  resource_name: string;
  path: string;
  timestamp: string;
  message: string;
}

export interface RecentProject {
  name: string;
  path: string;
  resource_count: number;
  total_size: number;
  last_opened: string;
}

export interface Thresholds {
  large_ytd: number;
  large_yft: number;
  large_awc: number;
  overall_resource: number;
}

export interface AppSettings {
  language: string;
  default_output_dir: string;
  thresholds: Thresholds;
}

interface DextaDb {
  settings: AppSettings;
  recent_activity: RecentActivity[];
  recent_projects: RecentProject[];
}

interface AppState {
  currentPage: string;
  settings: AppSettings;
  recentActivity: RecentActivity[];
  recentProjects: RecentProject[];
  isPro: boolean;

  // Selected paths / Workspace
  selectedPath: string;
  scannedResource: FiveMResource | null;
  scannedCollection: FiveMResource[];

  // Active state results
  streamReport: StreamAnalysisReport | null;
  mergePreview: MergePreview | null;
  validationResult: ValidationResult | null;
  dependencyReport: DependencyScanReport | null;

  // Action setters
  setCurrentPage: (page: string) => void;
  setSelectedPath: (path: string) => void;
  loadDb: () => Promise<void>;
  saveDbSettings: (settings: AppSettings) => Promise<void>;
  setScannedResource: (res: FiveMResource | null) => void;
  setScannedCollection: (cols: FiveMResource[]) => void;
  setStreamReport: (rep: StreamAnalysisReport | null) => void;
  setMergePreview: (prev: MergePreview | null) => void;
  setValidationResult: (res: ValidationResult | null) => void;
  setDependencyReport: (rep: DependencyScanReport | null) => void;
  clearHistory: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  currentPage: 'dashboard',
  settings: {
    language: 'en',
    default_output_dir: '',
    thresholds: {
      large_ytd: 16 * 1024 * 1024,
      large_yft: 16 * 1024 * 1024,
      large_awc: 15 * 1024 * 1024,
      overall_resource: 100 * 1024 * 1024,
    },
  },
  recentActivity: [],
  recentProjects: [],
  isPro: true, // completed tools unlocked for local developer access

  selectedPath: '',
  scannedResource: null,
  scannedCollection: [],

  streamReport: null,
  mergePreview: null,
  validationResult: null,
  dependencyReport: null,

  setCurrentPage: (page) => set({ currentPage: page }),
  setSelectedPath: (path) => set({ selectedPath: path }),

  loadDb: async () => {
    try {
      const db = await invoke<DextaDb>('load_settings');
      set({
        settings: db.settings,
        recentActivity: db.recent_activity,
        recentProjects: db.recent_projects,
      });
    } catch (e) {
      console.error('Failed to load storage db:', e);
    }
  },

  saveDbSettings: async (settings) => {
    try {
      const currentDb = {
        settings,
        recent_activity: get().recentActivity,
        recent_projects: get().recentProjects,
      };
      await invoke('save_settings', { db: currentDb });
      set({ settings });
    } catch (e) {
      console.error('Failed to save settings:', e);
    }
  },

  setScannedResource: (res) => set({ scannedResource: res }),
  setScannedCollection: (cols) => set({ scannedCollection: cols }),
  setStreamReport: (rep) => set({ streamReport: rep }),
  setMergePreview: (prev) => set({ mergePreview: prev }),
  setValidationResult: (res) => set({ validationResult: res }),
  setDependencyReport: (rep) => set({ dependencyReport: rep }),

  clearHistory: async () => {
    try {
      await invoke('clear_history');
      set({ recentActivity: [], recentProjects: [] });
    } catch (e) {
      console.error('Failed to clear history:', e);
    }
  },
}));
