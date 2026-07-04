import { z } from "zod";

export const createWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const renameWorkflowSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name is too long"),
});

export const workflowStateSchema = z.object({
  nodes: z.array(z.any()),
  edges: z.array(z.any()),
});
