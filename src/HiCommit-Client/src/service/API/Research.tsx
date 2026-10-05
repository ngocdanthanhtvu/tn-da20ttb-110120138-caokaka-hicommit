import { axiosInstance } from "./AxiosConfig";

export type ResearchExportFilters = {
    all?: boolean;
    ids?: string[];
    problems?: string[];
    role?: "STUDENT" | "TEACHER" | "ADMIN" | "";
    course_id?: string;
    contest_id?: string;
    context?: "FREE" | "COURSE" | "CONTEST" | "";
    from?: string;
    to?: string;
};

export type ResearchExportPreview = {
    exporter_version: string;
    record_schema_version: string;
    attempts_exported: number;
    filters: {
        combine_with: string;
        all: boolean;
        ids: string[] | null;
        problems: string[] | null;
        role: string | null;
        course_id: string | null;
        contest_id: string | null;
        context: string | null;
        from_utc: string | null;
        to_utc: string | null;
    };
};

const previewResearchExport = async (
    filters: ResearchExportFilters
): Promise<ResearchExportPreview> => {
    const response = await axiosInstance.post(
        "/research/export/preview",
        filters
    );

    return response.data;
};

function getFilename(
    contentDisposition: string | undefined,
    fallback: string
) {
    if (!contentDisposition) return fallback;

    const match = contentDisposition.match(
        /filename="?([^"]+)"?/i
    );

    return match?.[1] || fallback;
}

function decodeMetadata(value: string | undefined) {
    if (!value) return null;

    const binary = atob(value);
    const bytes = Uint8Array.from(
        binary,
        char => char.charCodeAt(0)
    );

    return JSON.parse(
        new TextDecoder("utf-8").decode(bytes)
    );
}

const downloadResearchExport = async (
    filters: ResearchExportFilters
) => {
    const response = await axiosInstance.post(
        "/research/export/download",
        filters,
        {
            responseType: "blob"
        }
    );

    const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-");

    const jsonlFilename = getFilename(
        response.headers["content-disposition"],
        `research_export_v2_${timestamp}.jsonl`
    );

    const metadataFilename =
        response.headers[
            "x-research-export-metadata-filename"
        ] ||
        `research_export_v2_${timestamp}.meta.json`;

    const metadata = decodeMetadata(
        response.headers["x-research-export-metadata"]
    );

    return {
        blob: response.data as Blob,
        jsonlFilename,
        metadataFilename,
        metadata,
        attempts:
            Number(
                response.headers[
                    "x-research-export-attempts"
                ]
            ) || 0
    };
};

export {
    previewResearchExport,
    downloadResearchExport
};
