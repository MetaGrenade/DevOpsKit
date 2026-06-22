export interface FrameworkProfile {
  framework: string;
  inventory: string;
  detectedResources: string[];
  recommendedAdapters: string[];
  source: "manual" | "detected" | "mixed";
  manual?: {
    framework?: string;
    inventory?: string;
  };
  autoDetected: {
    framework: string;
    inventory: string;
    detectedResources: string[];
  };
}

export interface WorkspaceWithConfig {
  id: string;
  name: string;
  directory: string;
  configPath: string;
  createdAt: string;
  updatedAt: string;
  workspace: {
    name: string;
    serverRoot: string;
    resourcesRoot: string;
    serverCfg: string;
  };
  resolvedPaths: {
    serverRoot: string;
    resourcesRoot: string;
    serverCfg: string;
    artifactOutput: string;
    reportPath: string;
  };
  pathChecks: {
    workspaceDirectory: boolean;
    serverRoot: boolean;
    resourcesRoot: boolean;
    serverCfg: boolean;
  };
  serverArtifact?: {
    build: number;
    source: "workspace.config" | "fxserver-artifact-version" | "citizen-version-json";
    path: string;
  };
  frameworkProfile?: FrameworkProfile;
}

export interface WorkspacesResponse {
  registryPath: string;
  activeWorkspaceId: string | null;
  workspaces: WorkspaceWithConfig[];
}

export interface CreateWorkspacePayload {
  name: string;
  workspaceDirectory: string;
  serverRoot: string;
  resourcesRoot: string;
  serverCfg: string;
}
