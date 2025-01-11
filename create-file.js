if (require('electron-squirrel-startup')) return

const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const fs = require('fs')
const path = require('path')
const wkhtmltopdf = require('wkhtmltopdf')

var mainWindow = {}

app.on('ready', () => {
    mainWindow = new BrowserWindow({
        webPreferences: {
            preload: __dirname + '/renderer.js',
            contextIsolation: true,
            enableRemoteModule: false,
            nodeIntegration: false,
            autoHideMenuBar: true
        }
    })

    mainWindow.setMenuBarVisibility(false)

    mainWindow.loadFile('index.html')

    console.log('aplicativo iniciado')
})

ipcMain.handle('gerar-pdf', async (event, data) => {
    return new Promise((resolve, reject) => {
        try {
            createFile(data)
            resolve('PDF criado com sucesso')
        } catch(e) {
            reject('erro ao criar PDF: ' + e.message)
        }
    })
})

ipcMain.on('fechar-app', () => {
    console.info('aplicativo encerrado')
    app.quit()
})

var htmlString = `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Document</title>
        <link rel="stylesheet" href="style.css">
        <style>
            /*{style}*/
        </style>
    </head>
    <body>
        <div id="header">`

var totalDucatCost = 0
var totalGloryCost = 0
var rangedWeapons = []
var meleeWeapons = []
var armours = []
var miscellaneous = []
var weaponsRules = []
var riskyActions = []
var goeticPowers = []
var actions = []
var abilities = []

function createFile(options) {
    try {
        css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf-8')
        addonsJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'addons.json'), 'utf-8'))
        upgradesJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'upgrades.json'), 'utf-8'))
        warband = JSON.parse(options.warbandFile)
        console.log('arquivos carregados com sucesso')
    } catch(e) {
        console.error('erro ao carregar arquivos: ' + e.stack)
        throw new Error('erro ao carregar arquivos: ' + e.message)
    }

    css = processCSS(css, options)

    htmlString = processWarband(warband, htmlString)
    htmlString = upperCaseToBold(htmlString)
    htmlString = htmlString.replace('/*{style}*/', css)
    htmlString += `</body>`

    try {
        generatePDF(htmlString)
        .then((pdfBuffer) => {
            savePDF(pdfBuffer)
            console.log('PDF salvo com sucesso')
        })
        .catch((e) => {
            console.error('erro ao salvar PDF: ' + e.stack)
        })
    } catch(e) {
        console.error('erro ao gerar PDF: ' + e.stack)
        throw new Error('erro ao gerar PDF: ' + e.message)
    }
}

function processWarband(warband, htmlContent) {
    htmlContent += `<h1>${warband.Name}</h1>
        <h2>${warband.Faction.Name}</h2>
        <table>
            <tr>
                <th>DUCATS</th>
                <th>GLORY</th>
                <th>UNITS</th>
                <th>PLAYER</th>
            </tr>
            <tr>
                <td>${warband.DucatCost}</td>
                <td>${warband.GloryCost}</td>
                <td>${warband.Members.length}</td>
                <td>${warband.Player}</td>
            </tr>
        </table>
    </div>
    <div id="models">`

    let eliteMembers = []
    let nonEliteMembers = []

    for(let i = 0; i < warband.Members.length; i++) {
        const member = warband.Members[i]
        if(member.Elite == true) {
            eliteMembers.push(member)
        }
        else {
            nonEliteMembers.push(member)
        }
    }

    if(eliteMembers.length > 0) {
        htmlContent += `<div id="models-elite">
            <h3>ELITE</h3>`

        for(let i = 0; i < eliteMembers.length; i++) {
            const member = eliteMembers[i];
            htmlContent += createModel(member)
        }

        htmlContent += `</div>`
    }

    if(nonEliteMembers.length > 0) {
        htmlContent += `<div id="models-non-elite">
            <h3>INFANTRY</h3>`

        for(let i = 0; i < nonEliteMembers.length; i++) {
            const member = nonEliteMembers[i];
            htmlContent += createModel(member)
        }

        htmlContent += `</div>`
    }

    return htmlContent + `</div>`
}

function createModel(member) {
    resetValues()

    addTotalCost(member.Model.Cost, member.Model.CostType)

    let rangedDice = member.Model.Object.Ranged[0]
    let meleeDice = member.Model.Object.Melee[0]

    if(member.Upgrades.length > 0) {
        for(let i = 0; i < member.Upgrades.length; i++) {
            addTotalCost(member.Upgrades[i].Cost, member.Upgrades[i].CostID)

            let upgrade = getUpgradeById(member.Upgrades[i].ID)

            if(getGlossaryUpgradeByVal(upgrade, 'GOETIC')) {
                goeticPowers.push(upgrade)
            }
            else if(upgrade.eventtags.action) {
                actions.push(upgrade)
            }
            else if(upgrade.eventtags.trait) {
                abilities.push(upgrade)
            }
            else {
                console.warn('tipo de upgrade não mapeado: ' + upgrade)
                abilities.push(upgrade)
            }

            if(upgrade.eventtags.movement) {
                member.Model.Object.Movement[0] += upgrade.eventtags.movement
            }
            if(upgrade.eventtags.movementset) {
                member.Model.Object.Movement[0] = upgrade.eventtags.movementset
                member.Model.Object.EventTags.flying = true
            }
            if(upgrade.eventtags.category_ranged) {
                rangedDice = !rangedDice ? 0 : rangedDice
            }
            if(upgrade.eventtags.category_melee) {
                meleeDice = !meleeDice ? 0 : meleeDice
            }
            if(upgrade.eventtags.ranged) {
                rangedDice += upgrade.eventtags.ranged
            }
            if(upgrade.eventtags.melee) {
                meleeDice += upgrade.eventtags.melee
            }
            if(upgrade.eventtags.armour) {
                member.Model.Object.Armour[0] += upgrade.eventtags.armour
            }
            if(upgrade.eventtags.sizeset) {
                member.Model.Object.Base[0] = member.Model.Object.Base[0] > upgrade.eventtags.sizeset ? member.Model.Object.Base[0] : upgrade.eventtags.sizeset
            }
        }
    }

    if(member.Equipment.length > 0) {
        for(let i = 0; i < member.Equipment.length; i++) {
            addTotalCost(member.Equipment[i].Cost, member.Equipment[i].CostType)

            let equipment = member.Equipment[i].Object

            if(equipment.EventTags.movement) {
                member.Model.Object.Movement[0] += equipment.EventTags.movement
            }
            if(equipment.EventTags.movementset) {
                member.Model.Object.Movement[0] = equipment.EventTags.movementset
                member.Model.Object.EventTags.flying = true
            }
            if(equipment.EventTags.category_ranged) {
                rangedDice = !rangedDice ? 0 : rangedDice
            }
            if(equipment.EventTags.category_melee) {
                meleeDice = !meleeDice ? 0 : meleeDice
            }
            if(equipment.EventTags.ranged) {
                rangedDice += equipment.EventTags.ranged
            }
            if(equipment.EventTags.melee) {
                meleeDice += equipment.EventTags.melee
            }
            if(equipment.EventTags.armour) {
                member.Model.Object.Armour[0] += equipment.EventTags.armour
            }
            if(equipment.EventTags.sizeset) {
                member.Model.Object.Base[0] = member.Model.Object.Base[0] > equipment.EventTags.sizeset ? member.Model.Object.Base[0] : equipment.EventTags.sizeset
            }
        }
    }

    rangedDice = weaponSkillToText(rangedDice)
    meleeDice = weaponSkillToText(meleeDice)

    let modelHtml = `<div class="model">
        <div class="model-header">
            <table>
                <tr class="header-row">
                    <th>${member.Name}</th>
                    <th>Ducats</th>
                    <th>Glory</th>
                    <th>Movement</th>
                    <th>Ranged</th>
                    <th>Melee</th>
                    <th>Armour</th>
                    <th>Base</th>
                </tr>
                <tr>
                    <td>${member.Model.Object.Name}</td>
                    <td>${totalDucatCost}</td>
                    <td>${totalGloryCost}</td>
                    <td>${member.Model.Object.Movement[0]}"/${member.Model.Object.EventTags.flying ? 'Flying' : 'Infantry'}</td>
                    <td>${rangedDice}</td>
                    <td>${meleeDice}</td>
                    <td>${member.Model.Object.Armour[0]}</td>
                    <td>${member.Model.Object.Base[0]}mm</td>
                </tr>
            </table>
        </div>`

    if(member.Equipment.length > 0) {
        modelHtml += `<div class="model-items">`

        for(let i = 0; i < member.Equipment.length; i++) {
            const equip = member.Equipment[i]

            switch(equip.Object.Category) {
                case 'ranged':
                    rangedWeapons.push(equip)
                    break

                case 'melee':
                    meleeWeapons.push(equip)
                    break

                case 'armour':
                    armours.push(equip)
                    break

                case 'equipment':
                    miscellaneous.push(equip)
                    break

                default:
                    console.warn('categoria de equipamento não mapeada: ' + equip.Object.Category)
                    miscellaneous.push(equip)
                    break
            }
        }

        if(rangedWeapons.length > 0 || meleeWeapons.length > 0) {
            modelHtml += `<div class="model-weapons">
                        <table>
                            <tr>
                                <th></th>
                                <th>Name</th>
                                <th>Type</th>
                                <th>Range</th>
                                <th>Modifiers</th>
                                <th>Keywords</th>
                            </tr>`
            
            if(rangedWeapons.length > 0) {
                for(let i = 0; i < rangedWeapons.length; i++) {
                    const weapon = rangedWeapons[i]
                    modelHtml += `<tr class="weapon">
                        <td class="icon-ranged">&#8982;</td>` +
                        createWeapon(weapon)
                }
            }

            if(meleeWeapons.length > 0) {
                for(let i = 0; i < meleeWeapons.length; i++) {
                    const weapon = meleeWeapons[i]
                    modelHtml += `<tr class="weapon">
                        <td class="icon-melee">&#9876;</td>` +
                        createWeapon(weapon)
                }
            }

            modelHtml += `</table></div>`
        }

        if(weaponsRules.length > 0) {
            for(let i = 0; i < weaponsRules.length; i++) {
                modelHtml += weaponsRules[i]
            }

            weaponsRules = []
        }

        modelHtml += `</div>`
    }

    for(let i = 0; i < member.Model.Object.Abilities.length; i++) {
        if(member.Model.Object.Abilities[i].Tags[0].val == 'addon') {
            let addon = getAddonById(member.Model.Object.Abilities[i].Content)

            if(addon.tags.length > 0) {
                if(addon.tags[0].tag_name == 'Risky') {
                    riskyActions.push(addon)
                }
                else if(addon.tags[0].tag_name == 'Goetic') {
                    if(addon.eventtags.action) {
                        goeticPowers.push(addon)
                    }
                    else {
                        abilities.push(addon)
                    }
                }
                else {
                    console.warn('tipo de tag no addons não mapeada: ' + addon.tags[0].tag_name)
                    abilities.push(addon)
                }
            }
            else if(addon.eventtags.action) {
                actions.push(addon)
            }
            else if(addon.eventtags.trait) {
                abilities.push(addon)
            }
            else {
                console.warn('característica não encontrada no addons: ' + addon)
                abilities.push(addon)
            }
        }
    }

    for(let i = 0; i < member.Model.Object.Equipment.length; i++) {
        if(member.Model.Object.Equipment[i].Tags[0].val == 'addon') {
            let addon = getAddonById(member.Model.Object.Equipment[i].Content)

            if(addon.tags.length > 0) {
                if(addon.tags[0].tag_name == 'Risky') {
                    riskyActions.push(addon)
                }
                else if(addon.tags[0].tag_name == 'Goetic') {
                    goeticPowers.push(addon)
                }
                else {
                    console.warn('tipo de tag no addons não mapeada: ' + addon.tags[0].tag_name)
                    abilities.push(addon)
                }
            }
            else if(addon.eventtags.action) {
                actions.push(addon)
            }
            else if(addon.eventtags.trait) {
                abilities.push(addon)
            }
            else {
                console.warn('característica não encontrada no addons: ' + addon)
                abilities.push(addon)
            }
        }
    }

    if(actions.length > 0) {
        modelHtml += `<div class="model-actions">` + createDivision('ACTIONS')
        for(let i = 0; i < actions.length; i++) {
            modelHtml += createAction(actions[i])
        }

        modelHtml += `</div>`
    }

    if(riskyActions.length > 0) {
        modelHtml += `<div class="model-actions">` + createDivision('RISKY ACTIONS')
        for(let i = 0; i < riskyActions.length; i++) {
            modelHtml += createRiskyAction(riskyActions[i])
        }

        modelHtml += `</div>`
    }

    if(goeticPowers.length > 0) {
        modelHtml += `<div class="model-actions">` + createDivision('GOETIC POWERS')
        for(let i = 0; i < goeticPowers.length; i++) {
            modelHtml += createGoeticPower(goeticPowers[i])
        }

        modelHtml += `</div>`
    }

    if(armours.length > 0) {
        modelHtml += `<div class="model-armours">` + createDivision('ARMOUR')
        for(let i = 0; i < armours.length; i++) {
            const armour = armours[i]
            modelHtml += `<div class="armour">
                    <span>${armour.Object.Name}: </span>${armour.Object.Description[0].SubContent[0].Content}
                </div>`
        }

        modelHtml += `</div>`
    }

    if(miscellaneous.length > 0) {
        modelHtml += `<div class="model-equipments">` + createDivision('EQUIPMENT')
        for(let i = 0; i < miscellaneous.length; i++) {
            const misc = miscellaneous[i]
            modelHtml += `<div class="equipment">
                    <span>${misc.Object.Name}: </span>${misc.Object.Description[0].SubContent[0].Content}
                </div>`
        }

        modelHtml += `</div>`
    }

    if(abilities.length > 0) {
        modelHtml += `<div class="model-abilities">` + createDivision('ABILITIES')
        for(let i = 0; i < abilities.length; i++) {
            modelHtml += createAbility(abilities[i])
        }

        modelHtml += `</div>`
    }

    return modelHtml + `</div>`
}

function resetValues() {
    totalDucatCost = 0
    totalGloryCost = 0
    rangedWeapons = []
    meleeWeapons = []
    armours = []
    miscellaneous = []
    weaponsRules = []
    riskyActions = []
    goeticPowers = []
    actions = []
    abilities = []
}

function addTotalCost(costValue, costType) {
    if(costType == 'ducats') {
        totalDucatCost += costValue
    }
    else if(costType == 'glory') {
        totalGloryCost += costValue
    }
    else {
        console.warn('tipo de custo não mapeado: ' + costType)
    }
}

function weaponSkillToText(skill) {
    if(isNaN(skill)) {
        return '-'
    }
    else {
        if(skill >= 0) {
            return '+' + skill + ' DICE'
        }
        else {
            return skill + ' DICE'
        }
    }
}

function createWeapon(weapon) {
    try {
        let rule = `<div class="weapon-rules">
                <span>*${weapon.Object.Name} Rule: </span>${weapon.Object.Description[0].SubContent[0].Content}
            </div>`
        weaponsRules.push(rule)
    } catch(e) {}

    let modifiers = ''
    if(weapon.Object.Modifiers.length > 0) {
        for(let i = 0; i < weapon.Object.Modifiers.length; i++) {
            modifiers += weapon.Object.Modifiers[i] + ', '
        }
        modifiers = modifiers.substring(0, modifiers.length - 2)
    }

    let keywords = ''
    if(weapon.Object.Tags.length > 0) {
        for(let i = 0; i < weapon.Object.Tags.length; i++) {
            keywords += weapon.Object.Tags[i].tag_name + ', '
        }
        keywords = keywords.substring(0, keywords.length - 2)
        keywords = keywords.toUpperCase()
    }

    let weaponHtml = `<td>${weapon.Object.Name}</td>
            <td>${weapon.Object.EquipType ? weapon.Object.EquipType : '-'}</td>
            <td>${weapon.Object.Range ? weapon.Object.Range : '-'}</td>
            <td>${modifiers ? modifiers : '-'}</td>
            <td>${keywords ? keywords : '-'}</td>
        </tr>`

    return weaponHtml
}

function createDivision(text) {
    return `<div class="container">
                <span class="text">${text}</span>

            </div>`
}

function getAddonById(id) {
    return addonsJson.find(function (addon) {
        return addon['id'] === id;
    }) || null;
}

function getUpgradeById(id) {
    return upgradesJson.find(function (upgrade) {
        return upgrade['id'] === id;
    }) || null;
}

function getGlossaryUpgradeByVal(upgrade, val) {
    return upgrade.description[0].glossary.find(function (glossary) {
        return glossary['val'] === val;
    }) || null;
}

function createRiskyAction(action) {
    return `<div class="risky action">` + _createAction(action)
}

function createGoeticPower(action) {
    return `<div class="goetic action">` + _createAction(action)
}

function createAction(action) {
    return `<div class="not-risky action">` + _createAction(action)
}

function _createAction(action) {
    return `<div class="action-tittle">${action.name}</div>
            <div class="action-description">${action.description[0].content}</div>
        </div>`
}

function createAbility(ability) {
    return `<div class="ability">
            <span>${ability.name}: </span>${ability.description[0].content}
        </div>`
}

function processCSS(cssContent, options) {
    cssContent = cssContent.replace('/*fontSize*/', options.fontSize)
    cssContent = cssContent.replace('/*action-bg*/', options.actionBgColor)
    cssContent = cssContent.replace('/*risky-action-bg*/', options.riskyActionBgColor)
    cssContent = cssContent.replace('/*goetic-power-bg*/', options.goeticPowerBgColor)

    const rootVariablesRegex = /:root\s*\{([\s\S]*?)\}/
    const match = cssContent.match(rootVariablesRegex)

    if (!match) {
        console.warn('nenhuma variável css encontrada no :root')
        return
    }

    const rootContent = match[1]
    const variables = {}

    rootContent.replace(/--([\w-]+):\s*([^;]+);/g, (fullMatch, varName, varValue) => {
        variables[varName] = varValue.trim()
    })

    const processedCSS = cssContent.replace(/var\((--[\w-]+)\)/g, (fullMatch, varName) => {
        const varKey = varName.replace(/^--/, '')
        return variables[varKey] || fullMatch
    })

    return processedCSS
}

function upperCaseToBold(text) {
    let exceptions = [
        'DOCTYPE',
        'UTF',
        'ELITE',
        'INFANTRY',
        'DUCATS',
        'GLORY',
        'UNITS',
        'PLAYER'
    ]

    return text.replace(/\b[A-ZÀ-Ú]{2,}\b/g, match => {
        if (exceptions.includes(match)) {
            return match
        }
        else {
            return `<span class="bold">${match}</span>`
        }
    })
}

function generatePDF(htmlString) {
    return new Promise((resolve, reject) => {
        let pdfChunks = []

        const stream = wkhtmltopdf(htmlString, {
            'enable-local-file-access': true,
            'dpi': 600,
            'encoding': 'utf-8',
            'disableSmartShrinking': true
        })
        
        stream.on('data', (chunk) => {
            pdfChunks.push(chunk)
        });

        stream.on('end', () => {
            const pdfBuffer = Buffer.concat(pdfChunks)
            resolve(pdfBuffer)
        });

        stream.on('error', (e) => {
            console.error(e.stack)
            reject(e.message)
        })
    })
}

function savePDF(pdfBuffer) {
    dialog.showSaveDialog({
    title: 'Salvar PDF',
    defaultPath: 'documento.pdf',
    filters: [
        {
            name: 'PDF Files',
            extensions: ['pdf']
        }
    ]
    }).then((result) => {
        if (!result.canceled && result.filePath) {
            fs.writeFile(result.filePath, pdfBuffer, (e) => {
                if(e) {
                    console.error('erro ao salvar PDF: ' + e.stack)
                }
                else {
                    console.log('PDF salvo com sucesso em: ' + result.filePath)
                }
            })
        }
    })
}