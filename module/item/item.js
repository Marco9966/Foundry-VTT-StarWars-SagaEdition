import {SWSE} from "../config.js";
import {generateAttackFromWeapon} from "../actor/attack-handler.js";
import {getBonusString} from "../util.js";

function getRangeModifier(range) {
    if(range === 'Grenades'){
        range = 'Thrown Weapons'
    }

    let firstHeader = "";
    let secondHeader = "";
    let radioButtons = "";
    let rangeArray = SWSE.Combat.range[range];
    if(rangeArray){
        for(let [rangeName, rangeIncrement] of Object.entries(rangeArray)){
            firstHeader += `<th><div class="swse padding-3 center">${rangeName.titleCase()} (${SWSE.Combat.rangePenalty[rangeName]})</div></th>`;
            secondHeader += `<th><div class="swse padding-3 center">${rangeIncrement.titleCase()}</div></th>`;
            radioButtons += `<td><div class="center swse"><label for="range${rangeName}"></label><input class="modifier center swse attack-modifier" type="radio" id="range_${rangeName}" name="range_selection" value="${SWSE.Combat.rangePenalty[rangeName]}"></div></td>`;
           // console.log(rangeName, rangeIncrement, SWSE.Combat.rangePenalty[rangeName])
        }

    }

    return `<table><thead><tr>${firstHeader}</tr><tr>${secondHeader}</tr></thead><tbody><tr>${radioButtons}</tr></tbody></table>`;
}

function getRateOfFireModifier(ratesOfFire) {
    if(ratesOfFire && ratesOfFire.length > 1) {
        let firstHeader = "";
        let radioButtons = "";
        for (let rateOfFire of ratesOfFire) {
            firstHeader += `<th><div class="swse padding-3 center">${rateOfFire}</div></th>`;
            radioButtons += `<td><div class="center swse"><label for="rof_${rateOfFire}"></label><input class="modifier center swse attack-modifier" type="radio" id="rof_${rateOfFire}" name="rof_selection" value="${"Autofire" === rateOfFire ? -5 : 0}"></div></td>`;

        }
        return `<br/><table><thead><tr>${firstHeader}</tr></thead><tbody><tr>${radioButtons}</tr></tbody></table>`;
    }
    return "";
}

function getStun(hasStun) {
    if(hasStun) {
        return `<br/><label for="stun_selection">Stun:</label><input class="modifier center swse attack-modifier" type="checkbox" id="stun_selection" name="stun_selection" value="0">`;
    }
    return "";
}

// noinspection JSClosureCompilerSyntax
/**
 * Extend the basic Item with some very simple modifications.
 * @extends {Item}
 */
export class SWSEItem extends Item {
    constructor(...args) {
        super(...args);
        this.items = this.items || [];
        this.hasItemOwner = this.hasItemOwner || false;
    }


    static get config() {
        return mergeObject(super.config, {
            baseEntity: Item,
            embeddedEntities: {
                "OwnedItem": "items"
            }
        });
    }

    get finalName() {
        return this.data?.data?.finalName;
    }

    get armorType(){
        if(this.data.data.armor.type === 'Heavy Armor' || this.data.data.armor.stripping.makeHeavy){
            return 'Heavy';
        }
        if(this.data.data.armor.type === 'Medium Armor' || this.data.data.armor.stripping.makeMedium){
            return 'Medium';
        }
            return 'Light';
    }

    get subType(){
        return this.data.data.subType;
    }

    /**
     * Augment the basic Item data model with additional dynamic data.
     */
    async prepareData() {
        super.prepareData();
        this._pendingUpdate = {};
        // Get the Item's data
        const itemData = this.data;
        
        this.resolveItemName();

        itemData.data.isEquipable = this.type === "weapon" || this.type === "armor";
        itemData.data.isModification = this.type === "upgrade" || this.subType === "weapons and armor accessories";
        itemData.data.isBioPart = this.subType === "Implants" || this.subType === "Bio-Implants" || this.subType === "Cybernetic Devices" || this.subType === "Advanced Cybernetics";
        itemData.data.isDroidPart = this.subType ===  "Locomotion Systems" || this.subType === "Processor Systems"
            || this.subType === "Appendages" || this.subType === "Droid Accessories (Sensor Systems)"
            || this.subType === "Droid Accessories (Translator Units)" || this.subType === "Droid Accessories (Miscellaneous Systems)"
            || this.subType === "Droid Accessories (Communications Systems)" || this.subType === "Droid Accessories (Droid Stations)"
            || this.subType === "Droid Accessories (Shield Generator Systems)";

        if (this.type === "weapon" ) this.prepareWeapon(itemData);
        if (this.type === "armor") this.prepareArmor(itemData);

        if (this.type === "feat") this.prepareFeatData(itemData);

        // if(Object.keys(this._pendingUpdate).length>0){
        //     return this.update(this._pendingUpdate);
        // }
    }

    prepareFeatData(itemData) {
        if (itemData.data.categories) {
            itemData.data.bonusFeatCategories = itemData.data.categories.filter(cat => cat.value.toLowerCase().includes("bonus feats"));
            itemData.data.hasBonusFeatCategories = itemData.data.bonusFeatCategories.length > 0;
        }
    }

    prepareWeapon(itemData) {
        itemData.data.upgradePoints = this.getBaseUpgradePoints(itemData.name);

        itemData.data.stripping = itemData.data.stripping ||{};


        let stripping = itemData.data.stripping;


        let reduceRange = this.setStripping('reduceRange', "Reduce Range", this.canReduceRange());
        this.data.data.resolvedSubtype = this.data.data.subtype;
        if (this.data.data.treatedAsForRange) {
            this.data.data.resolvedSubtype = this.data.data.treatedAsForRange;
        }
        if (reduceRange) {
            this.data.data.resolvedSubtype = this.reduceRange(this.data.data.resolvedSubtype);
        }


        this.setStripping('stripAutofire', "Strip Autofire", this.canStripAutoFire());

        this.setStripping('stripStun', "Strip Stun", this.canStripStun());
        itemData.data.isBaseExotic = this.isExotic();
        this.setStripping('stripDesign', "Make Exotic", !itemData.data.isBaseExotic);


        // if (weapon.damage && weapon.damage.attacks && weapon.damage.attacks.length > 0) {
        //     weapon.damage.finalDamage = weapon.damage.attacks[0].value;
        // }
        // if (weapon.stun && weapon.stun.isAvailable && !weapon.stripping.stun) {
        //     weapon.finalStun = weapon.damage?.finalDamage;
        //     if (weapon.stun.dieEquation) {
        //         weapon.finalStun = weapon.stun.dieEquation;
        //     }
        // }
        // if (stripping.damage) {
        //     if (weapon.damage.finalDamage) {
        //         weapon.damage.finalDamage = this.reduceDamage(weapon.damage.finalDamage);
        //     }
        //     if (weapon.finalStun) {
        //         weapon.finalStun = this.reduceDamage(weapon.finalStun);
        //     }
        // }
        // let ratesOfFire = weapon.ratesOfFire;
        // if (ratesOfFire) {
        //     if (weapon.stripping.autofire) {
        //         ratesOfFire = ratesOfFire.filter(rate => rate !== 'Autofire');
        //     }
        //
        //     weapon.finalRatesOfFire = ratesOfFire.join(", ");
        // }
        let size = itemData.data.size;

        itemData.data.resolvedSize = itemData.data.size;

        let makeTiny = this.setStripping('makeTiny', "Make Weapon Tiny", size === 'Diminutive');
        let makeSmall = this.setStripping('makeSmall', "Make Weapon Small", size === 'Tiny' || makeTiny);
        let makeMedium = this.setStripping('makeMedium', "Make Weapon Medium", size === 'Small' || makeSmall);
        let makeLarge = this.setStripping('makeLarge', "Make Weapon Large", size === 'Medium' || makeMedium);
        let makeHuge = this.setStripping('makeHuge', "Make Weapon Huge", size === 'Large' || makeLarge);
        let makeGargantuan = this.setStripping('makeGargantuan', "Make Weapon Gargantuan", size === 'Huge' || makeHuge);
        let makeColossal = this.setStripping('makeColossal', "Make Weapon Colossal", size === 'Gargantuan' || makeGargantuan);

        for(let stripped of Object.values(stripping)){
            itemData.data.upgradePoints += stripped.value ? 1 : 0;
        }

        if (itemData.data.items && itemData.data.items.length > 0) {
            for (let mod of itemData.data.items ? itemData.data.items : []) {
                if (mod.data.upgrade?.pointCost !== undefined) {
                    itemData.data.upgradePoints -= mod.data.upgrade.pointCost;
                }
            }
        }
    }

    setStripping(key, label, enabled) {
        this.data.data.stripping[key] = this.data.data.stripping[key] || {};
        this.data.data.stripping[key].label = label;
        this.data.data.stripping[key].enabled = enabled;
        this.data.data.stripping[key].value = enabled ? this.data.data.stripping[key].value || false : false;
        return this.data.data.stripping[key].value;
    }

    prepareArmor(itemData) {
        itemData.data.upgradePoints = this.getBaseUpgradePoints(itemData.name);


        if (this.type === "armor") {
            if (!itemData.data.armor.stripping) {
                itemData.data.armor.stripping = {};
            }
            let stripping = itemData.data.armor.stripping;
            //itemData.data.armor.reflexBonus, itemData.data.armor.fortitudeBonus

            stripping.canMakeMedium = itemData.data.armor.type === 'Light Armor'; //if is light
            stripping.canMakeHeavy = itemData.data.armor.type === 'Medium Armor' || stripping.makeMedium; //if is medium or made medium
            stripping.defensiveMaterial = Math.min(itemData.data.armor.reflexBonus ? itemData.data.armor.reflexBonus : 0,
                itemData.data.armor.fortitudeBonus ? itemData.data.armor.fortitudeBonus : 0); //min(fort/reflex)
            stripping.canReduceDefensiveMaterial = stripping.defensiveMaterial > 0;
            stripping.reduceDefensiveMaterial = Math.max(Math.min(stripping.reduceDefensiveMaterial || 0, stripping.defensiveMaterial), 0);
            stripping.jointProtection = itemData.data.armor.maxDexterity ? itemData.data.armor.maxDexterity : 0
            stripping.canReduceJointProtection = stripping.jointProtection > 0;
            stripping.reduceJointProtection = Math.max(stripping.reduceJointProtection || 0, 0);

            itemData.data.upgradePoints += stripping.makeMedium ? 1 : 0;
            itemData.data.upgradePoints += stripping.makeHeavy ? 1 : 0;
            itemData.data.upgradePoints += stripping.reduceJointProtection;
            itemData.data.upgradePoints += stripping.reduceDefensiveMaterial;

        }

        try {
            if (itemData.data.items && itemData.data.items.length > 0) {
                for (let mod of itemData.data.items) {
                    if (mod.data.upgrade?.pointCost !== undefined) {
                        itemData.data.upgradePoints -= mod.data.upgrade.pointCost;
                    }
                }
            }
        } catch (e) {
            console.log("mods may not be initialized", e)
        }
    }

    resolveItemName() {
        let itemData = this.data;
        let finalName = itemData.name;
        if (itemData.data.payload && itemData.data.payload !== "" && !itemData.name.includes("(")) {
            finalName = `${finalName} (${itemData.data.payload})`
        }
        for (let mod of this.data.data.items ? this.data.data.items : []) {
            let prefix = mod.data.attributes.prefix ? mod.data.attributes.prefix + " " : "";
            let suffix = mod.data.attributes.suffix ? " " + mod.data.attributes.suffix : "";
            finalName = `${prefix}${finalName}${suffix}`
        }
        itemData.data.finalName=finalName;
        // if(finalName !== itemData.data.finalName) {
        //     this._pendingUpdate['data.finalName'] = finalName;
        // }
    }
    setTextDescription() {
        let itemData = this.data;
        itemData.data.textDescription = this.stripHTML(itemData.data.description);
    }
    setSourceString() {
        let sourceString='';

        let itemData = this.data;
        if(itemData.data.supplier) {
            sourceString = `${itemData.data.supplier.type}, ${itemData.data.supplier.name}`;
        }
        this.data.data.sourceString = sourceString;
    }

    setPayload(payload) {
        this.data.data.payload = payload;
        this.crawlPrerequisiteTree(this.data.data.prerequisite, (prerequisite) =>{
            if(prerequisite.requirement) {
                prerequisite.requirement = prerequisite.requirement.replace("#payload#", payload);
            }
            if(prerequisite.text) {
                prerequisite.text = prerequisite.text.replace("#payload#", payload);
            }
        })
        this.resolveItemName();
    }

    /**
     *
     * @param prerequisite
     * @param {function} funct
     */
    crawlPrerequisiteTree(prerequisite, funct) {
        if(!prerequisite){
            return;
        }
        funct(prerequisite);
        for(let child of prerequisite.children ? prerequisite.children: []){
            this.crawlPrerequisiteTree(child, funct);
        }
    }

    setParentItem(parentItem){
        this.data.data.supplier = {id: parentItem.id, name: parentItem.name, type: parentItem.data.type};
        this.data.data.isSupplied = true;
    }

    stripHTML(str) {
        let parser = new DOMParser();
        let doc = parser.parseFromString(str, 'text/html');
        return doc.body.innerText;
    };

    async takeOwnership(item) {
        let items = this.data.data.items;
        items.push(item)
        await this.update({"data.items": [...new Set(items)]});
        await item.update({"data.hasItemOwner": true});
    }

    async revokeOwnership(item) {
        let items = this.data.data.items.filter(i => i._id !== item.data._id);
        await this.update({"data.items": items});
        await item.update({"data.hasItemOwner": false});
    }

    canReduceRange() {
        let subtypes = ["pistols", "rifles", "ranged weapons", "grenades", "heavy weapons", "simple ranged weapons", "thrown"];
        return subtypes.includes(this.data.data.subtype?.toLowerCase()) || subtypes.includes(this.data.data.attributes?.treatedAsForRange?.toLowerCase())
    }


    canStripAutoFire() {
        return this.data.data.attributes.ratesOfFire && this.data.data.attributes.ratesOfFire.value.includes("Single-Shot") && this.data.data.attributes.ratesOfFire.value.includes("Autofire");
    }
    canStripStun() {
        return this.data.data.attributes.stunDamageDie && this.data.data.attributes.damageDie;
    }

    isExotic() {
        return ['Exotic Ranged Weapons' || 'Exotic Melee Weapons'].includes(this.subType);
    }

    async removeCategory(index) {
        let attacks = this.data.data.weapon.damage.attacks;
        if (!Array.isArray(attacks)) {
            let temp = [];
            for (let attack of Object.values(attacks)) {
                temp.push(attack);
            }
            attacks = temp;
        }
        console.log(attacks);
        attacks.splice(index, 1);
        await this.update({"data.weapon.damage.attacks": attacks});
    }

    async addCategory() {
        let attacks = this.data.data.weapon.damage.attacks;
        if (!Array.isArray(attacks)) {
            let temp = [];
            for (let attack of Object.values(attacks)) {
                temp.push(attack);
            }
            attacks = temp;
        }
        console.log(attacks);
        attacks.push({key: "", value: "", dtype: "String"});
        await this.update({"data.weapon.damage.attacks": attacks});
    }

    getBaseUpgradePoints(ogName) {
        //TODO find power armors and add them here https://swse.fandom.com/wiki/Category:Powered_Armor

        return 1;
    }

    reduceRange(finalWeaponRange) {
        let ranges = ["Melee", "Thrown", "Pistols", "Rifles", "Heavy Weapons"];
        let index = ranges.indexOf(finalWeaponRange === 'Simple Ranged Weapon' ? "Pistols" : (finalWeaponRange === 'Grenades' ? "Thrown" : finalWeaponRange));
        return ranges[index - 1];
    }

    reduceDamage(finalDamage) {
        let dieSize = ["2", "3", "4", "6", "8", "10", "12"];
        let toks = finalDamage.split("d");
        let index = dieSize.indexOf(toks[1]);
        if (index === 0) {
            index = 1;
        }
        toks[1] = dieSize[index - 1];
        return toks[0] + "d" + toks[1];
    }

    /**
     *
     * @param {SWSEActor} actor
     * @returns {Dialog}
     */
    rollItem(actor){

        if(this.type === "weapon"){
            let attack = generateAttackFromWeapon(this, actor);
            console.log(attack);
            let modifiers = "";
            modifiers += getRangeModifier(this.data.data.resolvedSubtype)  //add innacurate and accurate
            modifiers += getRateOfFireModifier(attack.ratesOfFire);
            modifiers += getStun(attack.hasStun)
            let templateType = "attack";
            const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

            let content = `<div class="dialog">${modifiers}<div class="flex flex-row"><button class="roll" id="attack" data-roll="${attack.th}">Attack Roll</button><button class="roll" id="damage" data-roll="${attack.dam}">Damage Roll</button></div></div>`;
            return new Dialog({
                title: 'Attacks',
                content: content,
                buttons: {
                    close: {
                        icon: '<i class="fas fa-check"></i>',
                        label: 'Close'
                    }
                },
                render: html => {
                    html.find("button.roll").on("click", (event) => {
                        let target = $(event.currentTarget);

                        console.log(event.currentTarget.id)
                        let formula = target.data("roll");
                        let parent = target.parents(".dialog")
                        if(event.currentTarget.id === "attack"){
                            let attackMods = parent.find(".attack-modifier")
                            for(let attackMod of attackMods){
                                if(attackMod.checked){
                                    formula += getBonusString(attackMod.value);
                                }
                            }

                        } else if(event.currentTarget.id === "damage"){
                            let damageMods = parent.find(".damage-modifier")

                            for(let damageMod of damageMods){
                                if(damageMod.checked){
                                    formula += getBonusString(damageMod.value);
                                }
                            }
                        }
                        //target.
                        let name = target.data("name");
                        let modifications = target.data("modifications");
                        let notes = target.data("notes");

                        actor.sendRollToChat(template, formula, modifications, notes, name, actor);
                    });
                }
            })
        }
    }

    static getItemDialogue(attacks, actor) {
        let templateType = "attack";
        const template = `systems/swse/templates/chat/${templateType}-card.hbs`;

        let content = '';
        for (let attack of attacks) {
            content += `<p><button class="roll" data-roll="${attack.th}" data-name="${attack.name} Attack Roll">${attack.name} Roll Attack</button></p>
                       <p><button class="roll" data-roll="${attack.dam}" data-name="${attack.name} Damage Roll">${attack.name} Roll Damage</button></p>`
        }
        //let actor = this;

        return new Dialog({
            title: 'Attacks',
            content: content,
            buttons: {
                close: {
                    icon: '<i class="fas fa-check"></i>',
                    label: 'Close'
                }
            },
            render: html => {
                html.find("button.roll").on("click", (event) => {
                    let target = $(event.currentTarget);
                    let formula = target.data("roll");
                    let name = target.data("name");
                    let modifications = target.data("modifications");
                    let notes = target.data("notes");

                    actor.sendRollToChat(template, formula, modifications, notes, name, actor);
                });
            }
        })
    }
}
