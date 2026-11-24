<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[Fillable(['campus_id', 'from_key', 'to_key', 'weight', 'kind', 'accessible'])]
class NavEdge extends Model
{
    protected function casts(): array
    {
        return [
            'accessible' => 'boolean',
        ];
    }

    public function campus(): BelongsTo
    {
        return $this->belongsTo(Campus::class);
    }
}
