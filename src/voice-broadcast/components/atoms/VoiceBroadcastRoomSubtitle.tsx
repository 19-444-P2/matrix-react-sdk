/*
Copyright 2022 The Matrix.org Foundation C.I.C.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/

import React from "react";

import { Icon as LiveIcon } from "../../../../res/img/element-icons/live.svg";
import { _t } from "../../../languageHandler";

export const VoiceBroadcastRoomSubtitle = () => {
    return <div className="mx_RoomTile_subtitle mx_RoomTile_subtitle--voice-broadcast">
        <LiveIcon className="mx_Icon mx_Icon_16" />
        { _t("Live") }
    </div>;
};
