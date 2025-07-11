import React, { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { Label } from '../ui/Label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/Tabs'
import { Plus, Trash2, Save, Upload, Download, Copy } from 'lucide-react'
import { useForm, useFieldArray, Controller, useWatch } from 'react-hook-form'
import { appConfig } from '../../config/app.config'
import { useAppStore } from '../../store/useAppStore'
import toast from 'react-hot-toast'
import { useDebounce } from '../../hooks/useDebounce'
import { useAccount } from 'wagmi'

interface WorkflowFormData {
    count: number
    validAfter: string
    validUntil: string
    triggers: Array<{
        type: 'event' | 'cron' | 'manual'
        params: {
            // Event trigger params
            signature?: string
            contractAddress?: string
            chainId?: number
            filter?: {
                from?: string
                to?: string
                value?: string
            }
            // Cron trigger params
            expression?: string
        }
    }>
    jobs: Array<{
        id: string
        chainId: number
        steps: Array<{
            target: string
            abi: string
            args: string[]
            value: string
        }>
    }>
}

export function WorkflowBuilder() {
    const { address } = useAccount()
    const { currentWorkflow, setCurrentWorkflow } = useAppStore()
    const [activeTab, setActiveTab] = useState('basic')

    const { register, control, handleSubmit, watch, setValue, getValues } = useForm<WorkflowFormData>({
        defaultValues: {
            count: currentWorkflow?.count || 3,
            validAfter: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString().slice(0, 16), // 2 hours ago
            validUntil: currentWorkflow?.validUntil || new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString().slice(0, 16), // 2 hours from now
            triggers: currentWorkflow?.triggers || [
                {
                    type: 'cron',
                    params: {
                        expression: '*/5 * * * *' // Every 5 minutes
                    }
                }
            ],
            jobs: currentWorkflow?.jobs || [
                {
                    id: 'mint-nft-job-sepolia',
                    chainId: 11155111,
                    steps: [
                        {
                            target: '0x34bE7f35132E97915633BC1fc020364EA5134863',
                            abi: 'mint(address)',
                            args: [address || '{{ownerAccount.address}}'], // Use connected address or placeholder
                            value: '0'
                        }
                    ]
                }
            ]
        }
    })

    const { fields: triggerFields, append: appendTrigger, remove: removeTrigger } = useFieldArray({
        control,
        name: 'triggers'
    })

    const { fields: jobFields, append: appendJob, remove: removeJob } = useFieldArray({
        control,
        name: 'jobs'
    })

    const watchedValues = watch()
    const debouncedValues = useDebounce(watchedValues, 1000)

    // Auto-save to store on form changes with debounce
    React.useEffect(() => {
        const formData = debouncedValues as WorkflowFormData
        if (formData.count !== undefined) {
            setCurrentWorkflow(formData)
        }
    }, [debouncedValues, setCurrentWorkflow])

    // Update form values when wallet address changes
    React.useEffect(() => {
        if (address) {
            // Update all mint(address) args with the connected address
            const currentJobs = getValues('jobs')
            const updatedJobs = currentJobs.map(job => ({
                ...job,
                steps: job.steps.map(step => ({
                    ...step,
                    args: step.abi === 'mint(address)' && step.args.length > 0
                        ? [address] // Always use connected address for mint(address) functions
                        : step.args
                }))
            }))
            setValue('jobs', updatedJobs)

            // Force re-render to show updated values in the UI
            setTimeout(() => {
                setValue('jobs', updatedJobs)
            }, 100)
        }
    }, [address, setValue, getValues])

    const onSubmit = (data: WorkflowFormData) => {
        setCurrentWorkflow(data)
        toast.success('Workflow saved to builder')
    }

    const loadTemplate = (templateId: string) => {
        const template = appConfig.workflowTemplates.find(t => t.id === templateId)
        if (template) {
            setValue('count', template.template.count)
            setValue('triggers', template.template.triggers as WorkflowFormData['triggers'])

            // Update job arguments with connected address
            const updatedJobs = template.template.jobs.map(job => ({
                ...job,
                steps: job.steps.map(step => ({
                    ...step,
                    args: step.abi === 'mint(address)' && step.args.length > 0
                        ? [address || '{{ownerAccount.address}}'] // Always use connected address if available
                        : step.args
                }))
            })) as WorkflowFormData['jobs']

            setValue('jobs', updatedJobs)
            toast.success(`Loaded template: ${template.name}`)
        }
    }

    const exportWorkflow = () => {
        const data = watch()
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `workflow-${Date.now()}.json`
        a.click()
        URL.revokeObjectURL(url)
    }

    const importWorkflow = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (file) {
            const reader = new FileReader()
            reader.onload = (e: ProgressEvent<FileReader>) => {
                try {
                    const data = JSON.parse(e.target?.result as string)
                    Object.keys(data).forEach(key => {
                        setValue(key as keyof WorkflowFormData, data[key])
                    })
                    toast.success('Workflow imported successfully')
                } catch (error) {
                    toast.error('Invalid workflow file')
                }
            }
            reader.readAsText(file)
        }
    }

    const syncAddresses = () => {
        if (address) {
            const currentJobs = getValues('jobs')
            const updatedJobs = currentJobs.map(job => ({
                ...job,
                steps: job.steps.map(step => ({
                    ...step,
                    args: step.abi === 'mint(address)' && step.args.length > 0
                        ? [address]
                        : step.args
                }))
            }))
            setValue('jobs', updatedJobs)
            toast.success('All addresses synced to connected wallet')
        } else {
            toast.error('Please connect your wallet first')
        }
    }

    return (
        <Card className="w-full">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle>🎨 NFT Mint Template</CardTitle>
                        <CardDescription>
                            Pre-configured NFT minting workflow - runs every 5 minutes
                            {address && (
                                <span className="block text-green-600 font-medium">
                                    ✓ Connected wallet: {address.slice(0, 6)}...{address.slice(-4)}
                                    <span className="text-xs text-muted-foreground ml-2">(addresses auto-synced)</span>
                                </span>
                            )}
                        </CardDescription>
                    </div>
                    <div className="flex gap-2">
                        {address && (
                            <Button variant="outline" size="sm" onClick={syncAddresses} type="button">
                                <Copy className="mr-2 h-4 w-4" />
                                Sync Addresses
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={exportWorkflow} type="button">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                        </Button>
                        <label htmlFor="import-workflow" className="cursor-pointer">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={(e) => {
                                    e.preventDefault()
                                    document.getElementById('import-workflow')?.click()
                                }}
                                type="button"
                            >
                                <Upload className="mr-2 h-4 w-4" />
                                Import
                            </Button>
                        </label>
                        <input
                            id="import-workflow"
                            type="file"
                            accept=".json"
                            className="hidden"
                            onChange={importWorkflow}
                        />
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-4">
                            <TabsTrigger value="basic">Basic Info</TabsTrigger>
                            <TabsTrigger value="triggers">Triggers</TabsTrigger>
                            <TabsTrigger value="jobs">Jobs</TabsTrigger>
                            <TabsTrigger value="templates">Templates</TabsTrigger>
                        </TabsList>

                        <TabsContent value="basic" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label htmlFor="count">Execution Count</Label>
                                    <Input
                                        id="count"
                                        type="number"
                                        {...register('count', { valueAsNumber: true })}
                                        placeholder="Maximum executions"
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="validAfter">Valid After</Label>
                                    <Input
                                        id="validAfter"
                                        type="datetime-local"
                                        {...register('validAfter')}
                                    />
                                </div>
                                <div>
                                    <Label htmlFor="validUntil">Valid Until</Label>
                                    <Input
                                        id="validUntil"
                                        type="datetime-local"
                                        {...register('validUntil')}
                                    />
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="triggers" className="space-y-4">
                            <div className="space-y-4">
                                {triggerFields.map((field, index) => (
                                    <TriggerItem
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        register={register}
                                        remove={() => removeTrigger(index)}
                                        watch={watch}
                                    />
                                ))}
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => appendTrigger({
                                            type: 'event',
                                            params: {
                                                signature: '',
                                                contractAddress: '',
                                                chainId: appConfig.chains.sepolia.id,
                                                filter: {}
                                            }
                                        })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Event Trigger
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => appendTrigger({
                                            type: 'cron',
                                            params: { expression: '*/5 * * * *' }
                                        })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Cron Trigger
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={() => appendTrigger({ type: 'manual', params: {} })}
                                    >
                                        <Plus className="mr-2 h-4 w-4" />
                                        Add Manual Trigger
                                    </Button>
                                </div>
                            </div>
                        </TabsContent>

                        <TabsContent value="jobs" className="space-y-4">
                            <div className="space-y-4">
                                {jobFields.map((field, index) => (
                                    <JobItem
                                        key={field.id}
                                        index={index}
                                        control={control}
                                        register={register}
                                        remove={() => removeJob(index)}
                                    />
                                ))}
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => appendJob({
                                        id: `mint-nft-job-${Date.now()}`,
                                        chainId: appConfig.chains.sepolia.id,
                                        steps: [
                                            {
                                                target: '0x34bE7f35132E97915633BC1fc020364EA5134863',
                                                abi: 'mint(address)',
                                                args: [address || '{{ownerAccount.address}}'],
                                                value: '0'
                                            }
                                        ]
                                    })}
                                    className="w-full"
                                >
                                    <Plus className="mr-2 h-4 w-4" />
                                    Add NFT Mint Job
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="templates" className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                {appConfig.workflowTemplates.map(template => (
                                    <Card
                                        key={template.id}
                                        className="cursor-pointer hover:border-primary"
                                        onClick={() => loadTemplate(template.id)}
                                    >
                                        <CardHeader>
                                            <CardTitle className="text-lg">{template.name}</CardTitle>
                                            <CardDescription>{template.description}</CardDescription>
                                        </CardHeader>
                                    </Card>
                                ))}
                            </div>
                        </TabsContent>
                    </Tabs>

                    <div className="flex justify-end gap-2">
                        <Button type="submit">
                            <Save className="mr-2 h-4 w-4" />
                            Save Workflow
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    )
}

// Sub-components
interface TriggerItemProps {
    index: number
    control: any
    register: any
    remove: () => void
    watch: any
}

function TriggerItem({ index, control, register, remove, watch }: TriggerItemProps) {
    const triggerType = watch(`triggers.${index}.type`)
    const [eventArgs, setEventArgs] = useState<Array<{ name: string, type: string, indexed: boolean }>>([])
    const [showArgs, setShowArgs] = useState(false)

    const parseEventABI = (signature: string) => {
        try {
            // Parse event signature like "Transfer(address indexed from, address indexed to, uint256 value)"
            const match = signature.match(/(\w+)\s*\((.*)\)/)
            if (!match) return []

            const [_, eventName, argsString] = match
            if (!argsString) return []

            // Split arguments and parse each one
            const args = argsString.split(',').map(arg => {
                const parts = arg.trim().split(/\s+/)
                const indexed = parts.includes('indexed')
                const type = parts[0]
                const name = parts[parts.length - 1]
                return { name, type, indexed }
            })

            return args
        } catch (e) {
            return []
        }
    }

    const handleParseABI = () => {
        const signature = watch(`triggers.${index}.params.signature`)
        const args = parseEventABI(signature)
        setEventArgs(args)
        setShowArgs(true)
    }

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1">
                            <Label>Trigger Type</Label>
                            <select
                                {...register(`triggers.${index}.type`)}
                                className="w-full rounded-md border border-input bg-background px-3 py-2"
                            >
                                <option value="manual">Manual</option>
                                <option value="event">Event</option>
                                <option value="cron">Cron</option>
                            </select>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={remove}
                            className="ml-2"
                            aria-label="Remove trigger"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    {triggerType === 'event' && (
                        <>
                            <div>
                                <Label>Event Signature (ABI)</Label>
                                <div className="flex gap-2">
                                    <Input
                                        {...register(`triggers.${index}.params.signature`)}
                                        placeholder="Transfer(address indexed from, address indexed to, uint256 value)"
                                        className="flex-1"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={handleParseABI}
                                    >
                                        Parse Args
                                    </Button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <Label>Contract Address</Label>
                                    <Input
                                        {...register(`triggers.${index}.params.contractAddress`)}
                                        placeholder="0x..."
                                    />
                                </div>
                                <div>
                                    <Label>Chain</Label>
                                    <select
                                        {...register(`triggers.${index}.params.chainId`, { valueAsNumber: true })}
                                        className="w-full rounded-md border border-input bg-background px-3 py-2"
                                    >
                                        {Object.values(appConfig.chains).map(chain => (
                                            <option key={chain.id} value={chain.id}>{chain.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {showArgs && eventArgs.length > 0 && (
                                <div>
                                    <Label>Event Filter Arguments</Label>
                                    <div className="space-y-2 mt-2">
                                        {eventArgs.map((arg, argIndex) => (
                                            <div key={argIndex} className="flex items-center gap-2">
                                                <div className="flex-1">
                                                    <Label className="text-xs text-muted-foreground">
                                                        {arg.name} ({arg.type}) {arg.indexed && '- indexed'}
                                                    </Label>
                                                    <Input
                                                        {...register(`triggers.${index}.params.filter.${arg.name}`)}
                                                        placeholder={`Filter by ${arg.name} (optional)`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-2">
                                        Leave empty to match any value. Only indexed parameters can be filtered.
                                    </p>
                                </div>
                            )}

                            {!showArgs && (
                                <div>
                                    <Label>Event Filters (Manual)</Label>
                                    <div className="space-y-2">
                                        <Input
                                            {...register(`triggers.${index}.params.filter.from`)}
                                            placeholder="From address (optional)"
                                        />
                                        <Input
                                            {...register(`triggers.${index}.params.filter.to`)}
                                            placeholder="To address (optional)"
                                        />
                                        <Input
                                            {...register(`triggers.${index}.params.filter.value`)}
                                            placeholder="Value (optional)"
                                        />
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {triggerType === 'cron' && (
                        <div>
                            <Label>Cron Expression</Label>
                            <Input
                                {...register(`triggers.${index}.params.expression`)}
                                placeholder="*/5 * * * * (every 5 minutes)"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                                Format: minute hour day month weekday
                            </p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

interface JobItemProps {
    index: number
    control: any
    register: any
    remove: () => void
}

function JobItem({ index, control, register, remove }: JobItemProps) {
    const { fields: stepFields, append: appendStep, remove: removeStep } = useFieldArray({
        control,
        name: `jobs.${index}.steps`
    })

    return (
        <Card>
            <CardContent className="pt-6">
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex-1 grid grid-cols-2 gap-4">
                            <div>
                                <Label>Job ID</Label>
                                <Input {...register(`jobs.${index}.id`)} placeholder="unique-job-id" />
                            </div>
                            <div>
                                <Label>Chain</Label>
                                <select
                                    {...register(`jobs.${index}.chainId`, { valueAsNumber: true })}
                                    className="w-full rounded-md border border-input bg-background px-3 py-2"
                                >
                                    {Object.values(appConfig.chains).map(chain => (
                                        <option key={chain.id} value={chain.id}>{chain.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={remove}
                            className="ml-2"
                            aria-label="Remove job"
                        >
                            <Trash2 className="h-4 w-4" />
                        </Button>
                    </div>

                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <Label>Steps</Label>
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => appendStep({
                                    target: '',
                                    abi: '',
                                    args: [],
                                    value: '0'
                                })}
                            >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Step
                            </Button>
                        </div>

                        {stepFields.map((field, stepIndex) => (
                            <StepItem
                                key={field.id}
                                jobIndex={index}
                                stepIndex={stepIndex}
                                control={control}
                                register={register}
                                remove={() => removeStep(stepIndex)}
                            />
                        ))}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

interface StepItemProps {
    jobIndex: number
    stepIndex: number
    control: any
    register: any
    remove: () => void
}

function StepItem({ jobIndex, stepIndex, control, register, remove }: StepItemProps) {
    const { fields: argFields, append: appendArg, remove: removeArg, replace: replaceArgs } = useFieldArray({
        control,
        name: `jobs.${jobIndex}.steps.${stepIndex}.args`
    })

    const [functionArgs, setFunctionArgs] = useState<Array<{ name: string, type: string }>>([])
    const [showParsedArgs, setShowParsedArgs] = useState(false)

    // Add watch to get current values
    const watchAbi = useWatch({
        control,
        name: `jobs.${jobIndex}.steps.${stepIndex}.abi`
    })

    const parseFunctionABI = (abi: string) => {
        try {
            // Parse function signature like "mint(address)" or "transfer(address to, uint256 amount)"
            const match = abi.match(/(\w+)\s*\((.*)\)/)
            if (!match) return []

            const [_, functionName, argsString] = match
            if (!argsString) return []

            // Split arguments and parse each one
            const args = argsString.split(',').map((arg, index) => {
                const parts = arg.trim().split(/\s+/)
                // Handle both "address to" and just "address" formats
                const type = parts[0]
                const name = parts.length > 1 ? parts[parts.length - 1] : `arg${index}`
                return { name, type }
            })

            return args
        } catch (e) {
            return []
        }
    }

    const handleParseABI = () => {
        const abi = watchAbi || ''
        const args = parseFunctionABI(abi)
        if (args.length > 0) {
            setFunctionArgs(args)
            setShowParsedArgs(true)
            // Clear existing args and create new ones based on parsed ABI
            replaceArgs(args.map(() => ''))
        } else {
            toast.error('Invalid function ABI format')
        }
    }

    return (
        <Card className="bg-muted/30">
            <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between">
                    <div className="flex-1 space-y-3">
                        <div>
                            <Label>Contract Address</Label>
                            <Input
                                {...register(`jobs.${jobIndex}.steps.${stepIndex}.target`)}
                                placeholder="0x..."
                            />
                        </div>

                        <div>
                            <Label>Function ABI/Name</Label>
                            <div className="flex gap-2">
                                <Input
                                    {...register(`jobs.${jobIndex}.steps.${stepIndex}.abi`)}
                                    placeholder="mint(address) or transfer(address to, uint256 amount)"
                                    className="flex-1"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={handleParseABI}
                                >
                                    Parse Args
                                </Button>
                            </div>
                        </div>

                        <div>
                            <Label>ETH Value (in wei)</Label>
                            <Input
                                {...register(`jobs.${jobIndex}.steps.${stepIndex}.value`)}
                                placeholder="0"
                            />
                        </div>

                        <div>
                            <Label>Function Arguments</Label>
                            {showParsedArgs && functionArgs.length > 0 ? (
                                <div className="space-y-2 mt-2">
                                    {functionArgs.map((arg, argIndex) => (
                                        <div key={argIndex}>
                                            <Label className="text-xs text-muted-foreground">
                                                {arg.name} ({arg.type})
                                            </Label>
                                            <Input
                                                {...register(`jobs.${jobIndex}.steps.${stepIndex}.args.${argIndex}`)}
                                                placeholder={`Enter ${arg.name}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-sm text-muted-foreground">Manual Arguments</span>
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => appendArg('')}
                                        >
                                            <Plus className="mr-1 h-3 w-3" />
                                            Add Arg
                                        </Button>
                                    </div>
                                    <div className="space-y-2">
                                        {argFields.map((field, argIndex) => (
                                            <div key={field.id} className="flex items-center gap-2">
                                                <Input
                                                    {...register(`jobs.${jobIndex}.steps.${stepIndex}.args.${argIndex}`)}
                                                    placeholder={`Argument ${argIndex + 1}`}
                                                    className="flex-1"
                                                />
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => removeArg(argIndex)}
                                                >
                                                    <Trash2 className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={remove}
                        aria-label="Remove step"
                    >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
            </CardContent>
        </Card>
    )
} 