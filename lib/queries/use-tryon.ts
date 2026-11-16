import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { clearModelPhoto, getTryOn, startTryOn, uploadModelPhoto } from "@/lib/api/client";

/** How often a running try-on is polled; each poll moves it along on the server */
const POLL_MS = 2000;

const tryOnKey = (jobId: string) => ["tryon", jobId] as const;

/** Starts a try-on (or gets the same outfit made earlier) */
export function useStartTryOn() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (garmentIds: string[]) => startTryOn(garmentIds),
    onSuccess: (job) => queryClient.setQueryData(tryOnKey(job.job_id), job),
  });
}

/** A try-on job, polled until it's done or failed */
export function useTryOn(jobId: string | null) {
  return useQuery({
    queryKey: tryOnKey(jobId ?? ""),
    queryFn: () => getTryOn(jobId!),
    enabled: jobId !== null,
    refetchInterval: (q) => (q.state.data && q.state.data.status !== "running" && q.state.data.status !== "queued" ? false : POLL_MS),
    staleTime: Infinity,
  });
}

/** Uploads or removes the user's own model photo; the closet row says which one is in use */
export function useModelPhoto() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: ["current-closet"] });
  return {
    upload: useMutation({ mutationFn: (photo: Blob) => uploadModelPhoto(photo), onSuccess: refresh }),
    clear: useMutation({ mutationFn: () => clearModelPhoto(), onSuccess: refresh }),
  };
}
