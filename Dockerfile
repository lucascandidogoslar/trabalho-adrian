# Usa uma imagem base oficial do Node.js
FROM node:20-alpine

# Define o diretório de trabalho dentro do contêiner
WORKDIR /usr/src/app

# Copia package.json e package-lock.json (ou npm-shrinkwrap.json)
# Isso permite que a camada de dependências seja cacheada
COPY package*.json ./

# Instala as dependências (preferencialmente usando npm ci para build reprodutível)
RUN npm install

# Copia o código fonte da aplicação para o diretório de trabalho
# O comando de falha indica que esta linha pode estar faltando ou incorreta
COPY . . 

# Expõe a porta que a aplicação Node.js está ouvindo
EXPOSE 3000

# Comando para rodar a aplicação quando o contêiner inicia
CMD [ "node", "server.js" ]