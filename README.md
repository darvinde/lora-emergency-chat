# LoRa Emergency Communication System

Developed as part of a team project at the University of Paderborn.

Copyright 2022-2023 Dominik Delgado Steuter, Johannes Dorfschmidt, Jannik Lukas Hense, Darvin Schlüter, Alisa Stiballe

## Licensing

This project is free software: you can redistribute it and/or modify it 
under the terms of the GNU Affero General Public License as published by the Free Software Foundation, 
either version 3 of the License, or (at your option) any later version.

This project is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; 
without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. 
See the GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License along with this project. 
If not, see <https://www.gnu.org/licenses/>. 

## Functional Overview



...  
For a detailed overview look at the provided documentation paper.

## Database

### Setup

For the database we use MariaDB.  
Database name: "main"  
User: "admin"  
Password: "password"  

The database needs to be installed and configured first.
```
sudo apt install mariadb-server
sudo mysql_secure_installation
sudo mysql -e "GRANT ALL ON *.* TO 'admin'@'localhost' IDENTIFIED BY 'password' WITH GRANT OPTION"
mysql -u admin -p password -e "CREATE DATABASE main"
```

### Rendering the Database in the Browser

If you want to render the database using a web server with PHP, put the index.php 
into /var/www/database/ 

An example setup for using the Apache web server:
```
sudo apt install apache2 php php-mysql
sudo mkdir -p /var/www/database
sudo chown -R www-data:www-data /var/www/database
sudo cp index.php /var/www/database/
sudo a2dissite 000-default.conf
sudo a2ensite database.conf
sudo systemctl reload apache2
```
