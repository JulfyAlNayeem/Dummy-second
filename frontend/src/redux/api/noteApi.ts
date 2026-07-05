// @ts-nocheck
import { BASE_URL } from "@/utils/baseUrls";
import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const noteApi = createApi({
  reducerPath: "notes",
  baseQuery: fetchBaseQuery({
    baseUrl: `${BASE_URL}notes`,
    credentials: "include",
  }),
  tagTypes: ["Notes"],
  endpoints: (builder) => ({
    getNotes: builder.query({
      query: ({ classId, page = 1, limit = 20 }) => ({
        url: `/${classId}`,
        params: { page, limit },
      }),
      providesTags: (result, error, { classId }) => [{ type: "Notes", id: classId }],
    }),

    createNote: builder.mutation({
      query: ({ classId, title, description, messageId }) => ({
        url: `/${classId}`,
        method: "POST",
        body: { title, description, messageId },
      }),
      invalidatesTags: (result, error, { classId }) => [{ type: "Notes", id: classId }],
    }),

    updateNote: builder.mutation({
      query: ({ noteId, classId, title, description }) => ({
        url: `/${noteId}`,
        method: "PATCH",
        body: { title, description },
      }),
      invalidatesTags: (result, error, { classId }) => [{ type: "Notes", id: classId }],
    }),

    deleteNote: builder.mutation({
      query: ({ noteId, classId }) => ({
        url: `/${noteId}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { classId }) => [{ type: "Notes", id: classId }],
    }),
  }),
});

export const {
  useGetNotesQuery,
  useCreateNoteMutation,
  useUpdateNoteMutation,
  useDeleteNoteMutation,
} = noteApi;
