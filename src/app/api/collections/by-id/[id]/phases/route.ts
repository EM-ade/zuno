import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { envConfig } from '@/config/env'

const supabase = createClient(
  envConfig.supabaseUrl,
  envConfig.supabaseServiceKey
)

// GET phases for a collection
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { data: phases, error } = await supabase
      .from('mint_phases')
      .select('*')
      .eq('collection_id', params.id)
      .order('start_time', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ phases })
  } catch (error) {
    console.error('Error fetching phases:', error)
    return NextResponse.json(
      { error: 'Failed to fetch phases' },
      { status: 500 }
    )
  }
}

// POST create/update phases for a collection
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { phases } = await request.json()
    
    if (!phases || !Array.isArray(phases)) {
      return NextResponse.json(
        { error: 'Invalid phases data' },
        { status: 400 }
      )
    }

    // Delete existing phases for this collection
    const { error: deleteError } = await supabase
      .from('mint_phases')
      .delete()
      .eq('collection_id', params.id)

    if (deleteError) {
      console.error('Error deleting phases:', deleteError)
    }

    // Insert new phases
    if (phases.length > 0) {
      const phasesToInsert = phases.map(phase => ({
        collection_id: params.id,
        name: phase.name,
        phase_type: phase.phase_type,
        price: phase.price,
        start_time: phase.start_time,
        end_time: phase.end_time || null,
        mint_limit: phase.mint_limit || null
        // Note: allowed_wallets column doesn't exist in the database
        // If you need whitelist functionality, you'll need to add this column to the database
      }))

      const { data: insertedPhases, error: insertError } = await supabase
        .from('mint_phases')
        .insert(phasesToInsert)
        .select()

      if (insertError) {
        return NextResponse.json(
          { error: insertError.message },
          { status: 500 }
        )
      }

      return NextResponse.json({ 
        success: true, 
        phases: insertedPhases 
      })
    }

    return NextResponse.json({ 
      success: true, 
      phases: [] 
    })
  } catch (error) {
    console.error('Error saving phases:', error)
    return NextResponse.json(
      { error: 'Failed to save phases' },
      { status: 500 }
    )
  }
}
