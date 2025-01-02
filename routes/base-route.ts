import { z } from "zod"
import { Request, Response } from "express"

interface BaseInput {
  homeTeam: string
  awayTeam: string
}

export interface RouteConfig<TInput extends BaseInput, TData> {
  inputSchema: z.ZodType<TInput>
  analyzer: (homeTeam: string, awayTeam: string) => Promise<TData>
  commentaryGenerator: (data: TData) => Promise<any>
}

export function createMatchRoute<TInput extends BaseInput, TData>(
  { inputSchema, analyzer, commentaryGenerator }: RouteConfig<TInput, TData>
) {
  return async (req: Request, res: Response) => {
    try {
      const validatedInput = inputSchema.parse(req.body) as TInput
      
      const result = await analyzer(
        validatedInput.homeTeam, 
        validatedInput.awayTeam
      )
      
      const content = await commentaryGenerator(result)
      
      return res.json({ 
        success: true, 
        content,
        timestamp: new Date().toISOString()
      })
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          success: false,
          error: "Validation error",
          details: error.errors
        })
      }

      console.error("Error in match route:", error)
      return res.status(500).json({
        success: false,
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error"
      })
    }
  }
} 