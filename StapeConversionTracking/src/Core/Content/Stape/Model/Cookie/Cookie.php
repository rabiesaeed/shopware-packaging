<?php

declare(strict_types=1);

namespace Stape\ConversionTracking\Core\Content\Stape\Model\Cookie;

final class Cookie
{
    public function __construct
    (
        private readonly string $fbp = "",
        private readonly string $fbc = "",
        private readonly string $fpgclaw = "",
        private readonly string $gclAw = "",
        private readonly string $ttclid = "",
        private readonly string $ttp = "",
        private readonly string $fpid = "",
        private readonly string $gclGb = "",
        private readonly string $scid = "",
        private readonly string $fpgclgb = "",
        private readonly string $outbrainCid = "",
        private readonly string $taboolaCid = "",
        private readonly string $liFatId = "",
        private readonly string $impactCid = "",
        private readonly string $epik = "",
        private readonly string $scclid = "",
        private readonly string $uetmsclkid = "",
        private readonly string $ga = "",
    )
    {
    }

    public function toArray(): array
    {
        return [
            "_fbp" => $this->fbp,
            "_fbc" => $this->fbc,
            "FPGCLAW" => $this->fpgclaw,
            "_gcl_aw" => $this->gclAw,
            "ttclid" => $this->ttclid,
            "_ttp" => $this->ttp,
            "FPGCLGB" => $this->fpgclgb,
            "FPID"=> $this->fpid,
            "_ga" => $this->ga,
            "_gcl_gb" => $this->gclGb,
            "li_fat_id" => $this->liFatId,
            "taboola_cid" => $this->taboolaCid,
            "outbrain_cid" => $this->outbrainCid,
            "impact_cid"=> $this->impactCid,
            "_epik"=> $this->epik,
            "_scid"=> $this->scid,
            "_scclid"=> $this->scclid,
            "_uetmsclkid"=> $this->uetmsclkid
        ];
    }
}