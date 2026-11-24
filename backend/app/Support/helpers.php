<?php

if (! function_exists('media_url')) {
    /**
     * Public URL for a stored media file, served through the API media route.
     */
    function media_url(?string $path): ?string
    {
        if ($path === null || $path === '') {
            return null;
        }

        return url('/api/media/'.ltrim($path, '/'));
    }
}
