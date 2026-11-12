import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { UpdateGarmentRequest } from "@/lib/api";
import { updateGarment, uploadGarmentPhoto } from "@/lib/api/client";
import { closetKeys } from "./use-closet";

/** Uploads a garment photo (the server removes the background), then refreshes the closet and item */
export function useUploadGarmentPhoto(garmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (photo: Blob) => uploadGarmentPhoto(garmentId, photo),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: closetKeys.all }),
  });
}

/** Saves the name and type the user typed */
export function useUpdateGarment(garmentId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: UpdateGarmentRequest) => updateGarment(garmentId, changes),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: closetKeys.all }),
  });
}
