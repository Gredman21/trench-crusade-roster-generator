# Pré requisito

Para executar esse aplicativo, é necessário ter o wkhtmltopdf configurado corretamente. É possível baixar uma versão compatível com seu sistema pelo link https://wkhtmltopdf.org/downloads.html. Verifique se o seu path está configurado corretamente com o caminho do executável dele. O caminho padrão no Windows (meu sistema) é "C:\Program Files\wkhtmltopdf\bin".

# Utilização

Vá para o site https://trenchcompendium.netlify.app/ e crie seu warband. Depois baixe ele em JSON e utilize esse aplicativo para tranformar em PDF.
Com o aplicativo já instalado e aberto, selecione o arquivo JSON do seu warband, escolha as cores de fundo das habilidades dos personagens e clique em Gerar Arquivo.

## Windows x64

Baixe o .exe e execute ele.

## Outras plataformas

Sem arquivos compilados por enquanto. Se quiser, pode clonar o respositório e gerar ai na sua plataforma. Utilizei o electron forge para buildar, então acredito que se instalar os pacotes do node o rodar o seguinte comando deve funcionar:

> npm run make

# Observação

Peguei como referência a versão do Trench Crusade 1.5.1 mas modifiquei algumas coisas para fazer sentido ao gerar o arquivo. Verifique se todas as informações do PDF gerado condizem com seu warband.