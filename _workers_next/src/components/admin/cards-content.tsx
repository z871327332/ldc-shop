'use client'

import { useState, useRef } from "react"
import { useI18n } from "@/lib/i18n/context"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { addCards, addCardsBatch, deleteCard, deleteAllCards } from "@/actions/admin"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { CopyButton } from "@/components/copy-button"
import { Trash2, Upload } from "lucide-react"
import { useRouter } from "next/navigation"

interface CardData {
    id: number
    cardKey: string
}

interface CardsContentProps {
    productId: string
    productName: string
    unusedCards: CardData[]
}

// 批次大小
const BATCH_SIZE = 50

export function CardsContent({ productId, productName, unusedCards }: CardsContentProps) {
    const { t } = useI18n()
    const router = useRouter()
    const fileInputRef = useRef<HTMLInputElement>(null)

    // 文件上传状态
    const [uploading, setUploading] = useState(false)
    const [progress, setProgress] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [processedCount, setProcessedCount] = useState(0)

    const handleSubmit = async (formData: FormData) => {
        try {
            await addCards(formData)
            toast.success(t('common.success'))
            router.refresh()
        } catch (e: any) {
            toast.error(e.message)
        }
    }

    // 处理文件上传
    const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setUploading(true)
        setProgress(0)
        setProcessedCount(0)
        setTotalCount(0)

        try {
            // 读取文件内容
            const text = await file.text()

            // 按换行分割，过滤空行
            const cardList = text
                .split(/\n/)
                .map(c => c.trim())
                .filter(c => c)

            if (cardList.length === 0) {
                toast.error(t('admin.cards.noCards'))
                setUploading(false)
                return
            }

            setTotalCount(cardList.length)

            // 分批上传
            let successCount = 0
            for (let i = 0; i < cardList.length; i += BATCH_SIZE) {
                const batch = cardList.slice(i, i + BATCH_SIZE)
                const result = await addCardsBatch(productId, batch)
                successCount += result.success
                setProcessedCount(Math.min(i + BATCH_SIZE, cardList.length))
                setProgress(Math.round(((i + BATCH_SIZE) / cardList.length) * 100))
            }

            toast.success(t('admin.cards.uploadSuccess', { count: successCount }))
            router.refresh()
        } catch (e: any) {
            toast.error(e.message)
        } finally {
            setUploading(false)
            setProgress(0)
            setProcessedCount(0)
            setTotalCount(0)
            // 清空文件输入
            if (fileInputRef.current) {
                fileInputRef.current.value = ''
            }
        }
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">{t('admin.cards.title')}: {productName}</h1>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold">{unusedCards.length}</div>
                    <div className="text-xs text-muted-foreground">{t('admin.cards.available')}</div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
                <Card>
                    <CardHeader>
                        <CardTitle>{t('admin.cards.addCards')}</CardTitle>
                        <CardDescription>{t('admin.cards.fileHint')}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* 文件上传区域 */}
                        <div className="space-y-2">
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".txt,.csv"
                                onChange={handleFileUpload}
                                className="hidden"
                                disabled={uploading}
                            />
                            <Button
                                type="button"
                                variant="outline"
                                className="w-full"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={uploading}
                            >
                                <Upload className="h-4 w-4 mr-2" />
                                {uploading ? t('admin.cards.uploading') : t('admin.cards.uploadFile')}
                            </Button>

                            {/* 进度显示 */}
                            {uploading && (
                                <div className="space-y-2">
                                    <Progress value={progress} className="h-2" />
                                    <p className="text-sm text-muted-foreground text-center">
                                        {t('admin.cards.uploadProgress', {
                                            processed: processedCount,
                                            total: totalCount
                                        })}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <span className="w-full border-t" />
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-background px-2 text-muted-foreground">or</span>
                            </div>
                        </div>

                        {/* 手动输入区域 */}
                        <form action={handleSubmit} className="space-y-4">
                            <input type="hidden" name="product_id" value={productId} />
                            <Textarea
                                name="cards"
                                placeholder={t('admin.cards.placeholder')}
                                rows={10}
                                className="font-mono text-sm"
                                required
                                disabled={uploading}
                            />
                            <Button type="submit" className="w-full" disabled={uploading}>
                                {t('common.add')}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle>{t('admin.cards.available')}</CardTitle>
                        {unusedCards.length > 0 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={async () => {
                                    if (confirm(t('admin.cards.clearAllConfirm'))) {
                                        try {
                                            const result = await deleteAllCards(productId)
                                            toast.success(t('admin.cards.clearAllSuccess', { count: result.deleted }))
                                            router.refresh()
                                        } catch (e: any) {
                                            toast.error(e.message)
                                        }
                                    }
                                }}
                            >
                                <Trash2 className="h-4 w-4 mr-1" />
                                {t('admin.cards.clearAll')}
                            </Button>
                        )}
                    </CardHeader>
                    <CardContent className="max-h-[400px] overflow-y-auto space-y-2">
                        {unusedCards.length === 0 ? (
                            <div className="text-center py-10 text-muted-foreground text-sm">{t('admin.cards.noCards')}</div>
                        ) : (
                            unusedCards.map(c => (
                                <div key={c.id} className="flex items-center justify-between p-2 rounded bg-muted/40 text-sm font-mono gap-2">
                                    <CopyButton text={c.cardKey} truncate maxLength={30} />
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                        onClick={async () => {
                                            if (confirm(t('common.confirm') + '?')) {
                                                try {
                                                    await deleteCard(c.id)
                                                    toast.success(t('common.success'))
                                                    router.refresh()
                                                } catch (e: any) {
                                                    toast.error(e.message)
                                                }
                                            }
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}
