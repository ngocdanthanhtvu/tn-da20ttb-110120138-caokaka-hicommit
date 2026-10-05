import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import {
    Download,
    Eye,
    FileJson,
    Info
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

import { getCourseByIDForAdmin } from "@/service/API/Course";
import {
    downloadResearchExport,
    previewResearchExport,
    ResearchExportFilters,
    ResearchExportPreview
} from "@/service/API/Research";

function saveBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);
}

function ResearchExport() {
    const { course_id } = useParams();

    const [course, setCourse] = useState<any>(null);
    const [problem, setProblem] = useState("ALL");
    const [role, setRole] = useState("STUDENT");
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");

    const [previewResult, setPreviewResult] =
        useState<ResearchExportPreview | null>(null);

    const [loadingCourse, setLoadingCourse] = useState(true);
    const [previewing, setPreviewing] = useState(false);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        const loadCourse = async () => {
            try {
                setLoadingCourse(true);

                const response = await getCourseByIDForAdmin(
                    course_id as string
                );

                setCourse(response);
            } catch (error: any) {
                toast.error(
                    error?.response?.data?.error ||
                    error?.response?.data?.message ||
                    "Không thể tải thông tin khóa học"
                );
            } finally {
                setLoadingCourse(false);
            }
        };

        loadCourse();
    }, [course_id]);

    const problems = useMemo(() => {
        if (!course?.units) return [];

        return course.units.flatMap((unit: any) =>
            (unit?.children || []).map((item: any) => ({
                ...item,
                unitName: unit?.name
            }))
        );
    }, [course]);

    const invalidatePreview = () => {
        setPreviewResult(null);
    };

    const buildFilters = (): ResearchExportFilters => ({
        course_id,
        context: "COURSE",
        role:
            role === "ALL"
                ? undefined
                : role as "STUDENT" | "TEACHER" | "ADMIN",
        problems:
            problem === "ALL"
                ? undefined
                : [problem],
        from: fromDate || undefined,
        to: toDate || undefined
    });

    const handlePreview = async () => {
        try {
            setPreviewing(true);

            const result = await previewResearchExport(
                buildFilters()
            );

            setPreviewResult(result);
        } catch (error: any) {
            setPreviewResult(null);

            toast.error(
                error?.response?.data?.error ||
                "Không thể xem trước dữ liệu nghiên cứu"
            );
        } finally {
            setPreviewing(false);
        }
    };

    const handleExport = async () => {
        if (!previewResult) {
            toast.error("Vui lòng xem trước dữ liệu trước khi xuất");
            return;
        }

        try {
            setExporting(true);

            const result = await downloadResearchExport(
                buildFilters()
            );

            saveBlob(
                result.blob,
                result.jsonlFilename
            );

            if (result.metadata) {
                const metadataBlob = new Blob(
                    [
                        JSON.stringify(
                            result.metadata,
                            null,
                            2
                        ) + "\n"
                    ],
                    {
                        type: "application/json;charset=utf-8"
                    }
                );

                saveBlob(
                    metadataBlob,
                    result.metadataFilename
                );
            }

            toast.success(
                `Đã xuất ${result.attempts} lượt nộp`
            );
        } catch (error: any) {
            toast.error(
                error?.response?.data?.error ||
                "Không thể xuất dữ liệu nghiên cứu"
            );
        } finally {
            setExporting(false);
        }
    };

    if (loadingCourse) {
        return (
            <div className="p-7">
                Đang tải dữ liệu khóa học...
            </div>
        );
    }

    return (
        <div className="p-7 flex flex-col gap-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link to="/course-manager">
                                Quản lý khóa học
                            </Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>

                    <BreadcrumbSeparator />

                    <BreadcrumbItem>
                        <BreadcrumbLink asChild>
                            <Link
                                to={`/course-manager/${course_id}`}
                            >
                                {course?.name}
                            </Link>
                        </BreadcrumbLink>
                    </BreadcrumbItem>

                    <BreadcrumbSeparator />

                    <BreadcrumbItem>
                        Dữ liệu nghiên cứu
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <div>
                <div className="flex items-center gap-3">
                    <FileJson className="size-7 text-primary" />
                    <h1 className="text-2xl font-bold">
                        Dữ liệu nghiên cứu
                    </h1>
                </div>

                <p className="mt-2 text-sm opacity-60">
                    Xem trước và xuất dữ liệu hành vi lập trình
                    của khóa học theo Research Exporter V2.
                </p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Bộ lọc dữ liệu</CardTitle>
                    <CardDescription>
                        Các điều kiện được kết hợp theo AND.
                        Phạm vi khóa học được cố định theo khóa học
                        đang quản lý.
                    </CardDescription>
                </CardHeader>

                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="flex flex-col gap-2">
                        <Label>Bài tập</Label>

                        <Select
                            value={problem}
                            onValueChange={(value) => {
                                setProblem(value);
                                invalidatePreview();
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="ALL">
                                    Tất cả bài tập
                                </SelectItem>

                                {problems.map((item: any) => (
                                    <SelectItem
                                        key={item.id}
                                        value={item.slug}
                                    >
                                        {item.name} ({item.slug})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label>Vai trò người nộp</Label>

                        <Select
                            value={role}
                            onValueChange={(value) => {
                                setRole(value);
                                invalidatePreview();
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>

                            <SelectContent>
                                <SelectItem value="ALL">
                                    Tất cả vai trò
                                </SelectItem>
                                <SelectItem value="STUDENT">
                                    Sinh viên
                                </SelectItem>
                                <SelectItem value="TEACHER">
                                    Giảng viên
                                </SelectItem>
                                <SelectItem value="ADMIN">
                                    Quản trị viên
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        <p className="text-xs opacity-50">
                            Role là vai trò hiện tại của người dùng
                            tại thời điểm xuất dữ liệu.
                        </p>
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="research-from">
                            Từ ngày
                        </Label>

                        <Input
                            id="research-from"
                            type="date"
                            value={fromDate}
                            onChange={(event) => {
                                setFromDate(event.target.value);
                                invalidatePreview();
                            }}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <Label htmlFor="research-to">
                            Đến ngày
                        </Label>

                        <Input
                            id="research-to"
                            type="date"
                            value={toDate}
                            onChange={(event) => {
                                setToDate(event.target.value);
                                invalidatePreview();
                            }}
                        />

                        <p className="text-xs opacity-50">
                            Khoảng thời gian được Exporter xử lý theo UTC.
                        </p>
                    </div>
                </CardContent>
            </Card>

            <div className="flex gap-3">
                <Button
                    variant="secondary"
                    onClick={handlePreview}
                    disabled={previewing || exporting}
                >
                    <Eye className="size-4 mr-2" />
                    {previewing
                        ? "Đang xem trước..."
                        : "Xem trước"}
                </Button>

                <Button
                    onClick={handleExport}
                    disabled={
                        !previewResult ||
                        previewing ||
                        exporting
                    }
                >
                    <Download className="size-4 mr-2" />
                    {exporting
                        ? "Đang xuất..."
                        : "Xuất dữ liệu"}
                </Button>
            </div>

            {previewResult && (
                <Card>
                    <CardHeader>
                        <CardTitle>
                            Kết quả xem trước
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="flex flex-col gap-4">
                        <div className="flex flex-wrap gap-3">
                            <Badge variant="secondary">
                                {previewResult.attempts_exported}
                                {" "}lượt nộp
                            </Badge>

                            <Badge variant="outline">
                                Exporter {
                                    previewResult.exporter_version
                                }
                            </Badge>

                            <Badge variant="outline">
                                Schema {
                                    previewResult
                                        .record_schema_version
                                }
                            </Badge>
                        </div>

                        <div className="flex gap-2 text-sm opacity-70">
                            <Info className="size-4 mt-0.5 shrink-0" />
                            <p>
                                attempt_seq được tính trên toàn bộ
                                lịch sử nộp của từng người học và
                                bài tập trước khi các bộ lọc xuất
                                dữ liệu được áp dụng.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}

export default ResearchExport;
