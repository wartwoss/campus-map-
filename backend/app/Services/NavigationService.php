<?php

namespace App\Services;

use App\Models\Building;
use App\Models\Floor;
use App\Models\NavEdge;
use App\Models\NavNode;
use App\Models\Place;

class NavigationService
{
    public const STAIR_PENALTY = 6.0;

    public const ELEVATOR_PENALTY = 15.0;

    /**
     * Compute the shortest route between two places.
     *
     * @return array{
     *     from: array, to: array, total_distance: float,
     *     nodes: array, steps: array, accessible: bool
     * }|null
     */
    public function route(Place $from, Place $to, bool $accessibleOnly = false): ?array
    {
        $startNode = NavNode::where('place_id', $from->id)->orderBy('id')->first();
        $endNode = NavNode::where('place_id', $to->id)->orderBy('id')->first();

        if (! $startNode || ! $endNode) {
            return null;
        }

        [$nodes, $adjacency, $kinds] = $this->buildGraph($from->campus_id, $accessibleOnly);

        if (! isset($nodes[$startNode->key]) || ! isset($nodes[$endNode->key])) {
            return null;
        }

        $path = $this->dijkstra($adjacency, $startNode->key, $endNode->key);

        if ($path === null) {
            return null;
        }

        return $this->describeRoute($from, $to, $nodes, $adjacency, $kinds, $path, $accessibleOnly);
    }

    /**
     * @return array{
     *     0: array<string, array>,
     *     1: array<string, array<string, float>>,
     *     2: array<string, string>
     * }
     */
    private function buildGraph(int $campusId, bool $accessibleOnly): array
    {
        $nodes = NavNode::where('campus_id', $campusId)->get()->keyBy('key')->toArray();
        $adjacency = [];
        $kinds = [];

        foreach (NavEdge::where('campus_id', $campusId)->get() as $edge) {
            if ($accessibleOnly && ! $edge->accessible) {
                continue;
            }

            $a = $edge->from_key;
            $b = $edge->to_key;

            if (! isset($nodes[$a]) || ! isset($nodes[$b])) {
                continue;
            }

            $sameFrame = ($nodes[$a]['floor_id'] === null) === ($nodes[$b]['floor_id'] === null);
            $weight = $edge->weight ?? ($sameFrame ? $this->distance($nodes[$a], $nodes[$b]) : 8.0);

            if ($edge->kind === 'stair') {
                $weight += self::STAIR_PENALTY;
            } elseif ($edge->kind === 'elevator') {
                $weight += self::ELEVATOR_PENALTY;
            }

            $adjacency[$a][$b] = $weight;
            $adjacency[$b][$a] = $weight;
            $kinds[$a.'|'.$b] = $edge->kind;
            $kinds[$b.'|'.$a] = $edge->kind;
        }

        return [$nodes, $adjacency, $kinds];
    }

    /**
     * Euclidean distance inside one coordinate frame.
     *
     * @param  array<string, mixed>  $a
     * @param  array<string, mixed>  $b
     */
    private function distance(array $a, array $b): float
    {
        // Stair and elevator pairs sit at the same plan position on different
        // floors, so the vertical change is captured by the edge penalty.
        return round(sqrt(pow($a['x'] - $b['x'], 2) + pow($a['y'] - $b['y'], 2)), 2);
    }

    /**
     * @param  array<string, array<string, float>>  $adjacency
     * @return string[]|null
     */
    private function dijkstra(array $adjacency, string $start, string $goal): ?array
    {
        $dist = [$start => 0.0];
        $prev = [];
        $queue = [$start => 0.0];
        $visited = [];

        while ($queue !== []) {
            asort($queue);
            $current = array_key_first($queue);
            $currentDist = array_shift($queue);

            if ($current === $goal) {
                break;
            }

            if (isset($visited[$current])) {
                continue;
            }

            $visited[$current] = true;

            foreach ($adjacency[$current] ?? [] as $neighbor => $weight) {
                if (isset($visited[$neighbor])) {
                    continue;
                }

                $candidate = $currentDist + $weight;

                if (! isset($dist[$neighbor]) || $candidate < $dist[$neighbor]) {
                    $dist[$neighbor] = $candidate;
                    $prev[$neighbor] = $current;
                    $queue[$neighbor] = $candidate;
                }
            }
        }

        if (! isset($dist[$goal])) {
            return null;
        }

        $path = [$goal];
        $cursor = $goal;

        while (isset($prev[$cursor])) {
            $cursor = $prev[$cursor];
            array_unshift($path, $cursor);
        }

        return $path;
    }

    /**
     * @param  array<string, array>  $nodes
     * @param  array<string, array<string, float>>  $adjacency
     * @param  array<string, string>  $kinds
     * @param  string[]  $path
     */
    private function describeRoute(
        Place $from,
        Place $to,
        array $nodes,
        array $adjacency,
        array $kinds,
        array $path,
        bool $accessibleOnly,
    ): array {
        $sequence = [];

        foreach ($path as $key) {
            $sequence[] = [
                'key' => $key,
                'name' => $nodes[$key]['name'],
                'type' => $nodes[$key]['type'],
                'x' => $nodes[$key]['x'],
                'y' => $nodes[$key]['y'],
                'building_id' => $nodes[$key]['building_id'],
                'floor_id' => $nodes[$key]['floor_id'],
                'place_id' => $nodes[$key]['place_id'],
            ];
        }

        $floorIds = array_values(array_unique(array_filter(array_column($sequence, 'floor_id'))));
        $buildingIds = array_values(array_unique(array_filter(array_column($sequence, 'building_id'))));

        $floors = Floor::whereIn('id', $floorIds)->get()->keyBy('id');
        $buildings = Building::whereIn('id', $buildingIds)->get()->keyBy('id');

        $steps = [];
        $walkDistance = 0.0;
        $walkTail = null;

        $flushWalk = function (array &$steps, float &$walkDistance, ?string &$walkTail, bool $toTail = false): void {
            if ($walkDistance >= 0.5) {
                $text = 'Walk '.round($walkDistance).' m';
                $text .= $toTail && $walkTail ? ' to '.$walkTail : ($walkTail ? ' toward '.$walkTail : '');
                $steps[] = [
                    'action' => 'walk',
                    'distance' => round($walkDistance),
                    'text' => $text,
                ];
            }

            $walkDistance = 0.0;
            $walkTail = null;
        };

        $lastIndex = count($sequence) - 1;

        for ($i = 1; $i <= $lastIndex; $i++) {
            $prevNode = $sequence[$i - 1];
            $node = $sequence[$i];
            $kind = $kinds[$prevNode['key'].'|'.$node['key']] ?? 'path';
            $sameFrame = ($prevNode['floor_id'] === null) === ($node['floor_id'] === null);
            $segment = $sameFrame
                ? $this->distance($prevNode, $node)
                : ($adjacency[$prevNode['key']][$node['key']] ?? 0.0);
            $isLast = $i === $lastIndex;

            $floorChange = $prevNode['floor_id'] !== null
                && $node['floor_id'] !== null
                && $prevNode['floor_id'] !== $node['floor_id'];

            if (($node['type'] ?? '') === 'entrance') {
                // Include the final outdoor stretch up to the door, then enter.
                $walkDistance += $segment;
                $walkTail = $node['name'];
                $flushWalk($steps, $walkDistance, $walkTail);

                $buildingName = $node['building_id'] !== null
                    ? ($buildings[$node['building_id']]->name ?? 'the building')
                    : 'the building';
                $steps[] = [
                    'action' => 'enter',
                    'text' => 'Enter '.$buildingName,
                    'building_id' => $node['building_id'],
                ];
            } elseif ($floorChange) {
                $flushWalk($steps, $walkDistance, $walkTail);

                $targetFloor = $floors[$node['floor_id']] ?? null;
                $floorLabel = $targetFloor ? $targetFloor->name : 'the next floor';
                $direction = ($targetFloor?->level ?? 0) > ($floors[$prevNode['floor_id']]?->level ?? 0) ? 'up' : 'down';
                $via = $kind === 'elevator' ? 'the elevator' : 'the stairs';
                $steps[] = [
                    'action' => $kind === 'elevator' ? 'elevator' : 'stairs',
                    'text' => 'Take '.$via.' '.$direction.' to '.$floorLabel,
                    'floor_id' => $node['floor_id'],
                ];
            } else {
                $walkDistance += $segment;

                if ($node['name'] !== null && $node['name'] !== '') {
                    $walkTail = $node['name'];
                }
            }

            if ($isLast) {
                $flushWalk($steps, $walkDistance, $walkTail, toTail: true);
            }
        }

        $total = 0.0;

        for ($i = 1; $i <= $lastIndex; $i++) {
            $prevNode = $sequence[$i - 1];
            $node = $sequence[$i];
            $sameFrame = ($prevNode['floor_id'] === null) === ($node['floor_id'] === null);
            $total += $sameFrame
                ? $this->distance($prevNode, $node)
                : ($adjacency[$prevNode['key']][$node['key']] ?? 0.0);
        }

        return [
            'from' => [
                'id' => $from->id,
                'name' => $from->name,
                'category' => $from->category,
            ],
            'to' => [
                'id' => $to->id,
                'name' => $to->name,
                'category' => $to->category,
            ],
            'total_distance' => round($total),
            'estimated_minutes' => max(1, (int) round($total / 80)), // ~80 m/min walking pace
            'nodes' => $sequence,
            'steps' => $steps,
            'accessible' => $accessibleOnly,
        ];
    }
}
