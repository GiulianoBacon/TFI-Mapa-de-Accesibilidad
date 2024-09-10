-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema mapa
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema mapa
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `mapa` DEFAULT CHARACTER SET utf8 ;
USE `mapa` ;

-- -----------------------------------------------------
-- Table `mapa`.`usuario`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mapa`.`usuario` (
  `idUsuario` INT NOT NULL AUTO_INCREMENT,
  `email` VARCHAR(45) NOT NULL,
  `contraseña` VARCHAR(45) NOT NULL,
  `usuario` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idUsuario`, `email`))
ENGINE = InnoDB
AUTO_INCREMENT = 30
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `mapa`.`opinion_establecimiento`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mapa`.`opinion_establecimiento` (
  `idOpinion` INT NOT NULL AUTO_INCREMENT,
  `fecha` DATETIME NOT NULL,
  `latitud` VARCHAR(45) NOT NULL,
  `longitud` VARCHAR(45) NOT NULL,
  `Usuario_idUsuario` INT NOT NULL,
  `espacios_aptos` TINYINT NOT NULL,
  `ascensor_apto` TINYINT NOT NULL,
  `baños_aptos` TINYINT NOT NULL,
  `puerta_apta` TINYINT NOT NULL,
  `rampa_interna_apta` TINYINT NOT NULL,
  `rampa_externa_apta` TINYINT NOT NULL,
  `descripcion_rampa_interna` VARCHAR(45) NULL DEFAULT NULL,
  `descripcion_ascensor` VARCHAR(45) NULL DEFAULT NULL,
  `descripcion_rampa_externa` VARCHAR(45) NULL DEFAULT NULL,
  `descripcion_espacios` VARCHAR(45) NULL DEFAULT NULL,
  PRIMARY KEY (`idOpinion`),
  INDEX `fk_Opinion_establecimiento_Usuario1_idx` (`Usuario_idUsuario` ASC) VISIBLE,
  CONSTRAINT `fk_Opinion_establecimiento_Usuario1`
    FOREIGN KEY (`Usuario_idUsuario`)
    REFERENCES `mapa`.`usuario` (`idUsuario`))
ENGINE = InnoDB
AUTO_INCREMENT = 14
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `mapa`.`opinion_vereda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mapa`.`opinion_vereda` (
  `idOpinion_vereda` INT NOT NULL AUTO_INCREMENT,
  `latitud` VARCHAR(45) NOT NULL,
  `longitud` VARCHAR(45) NOT NULL,
  `Usuario_idUsuario` INT NOT NULL,
  `fecha` DATETIME NOT NULL,
  `vereda_apta` TINYINT NOT NULL,
  `descripcion_vereda` VARCHAR(45) NOT NULL,
  PRIMARY KEY (`idOpinion_vereda`),
  INDEX `fk_Opinion_vereda_Usuario1_idx` (`Usuario_idUsuario` ASC) VISIBLE,
  CONSTRAINT `fk_Opinion_vereda_Usuario1`
    FOREIGN KEY (`Usuario_idUsuario`)
    REFERENCES `mapa`.`usuario` (`idUsuario`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `mapa`.`puntaje_establecimiento`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mapa`.`puntaje_establecimiento` (
  `Usuario_idUsuario` INT NOT NULL,
  `Opinion_establecimiento_idOpinion` INT NOT NULL,
  `puntaje` INT NOT NULL,
  PRIMARY KEY (`Usuario_idUsuario`, `Opinion_establecimiento_idOpinion`, `puntaje`),
  INDEX `fk_Usuario_has_Opinion_establecimiento_Opinion_establecimie_idx` (`Opinion_establecimiento_idOpinion` ASC) VISIBLE,
  INDEX `fk_Usuario_has_Opinion_establecimiento_Usuario1_idx` (`Usuario_idUsuario` ASC) VISIBLE,
  CONSTRAINT `fk_Usuario_has_Opinion_establecimiento_Opinion_establecimiento1`
    FOREIGN KEY (`Opinion_establecimiento_idOpinion`)
    REFERENCES `mapa`.`opinion_establecimiento` (`idOpinion`),
  CONSTRAINT `fk_Usuario_has_Opinion_establecimiento_Usuario1`
    FOREIGN KEY (`Usuario_idUsuario`)
    REFERENCES `mapa`.`usuario` (`idUsuario`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


-- -----------------------------------------------------
-- Table `mapa`.`puntaje_vereda`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `mapa`.`puntaje_vereda` (
  `Usuario_idUsuario` INT NOT NULL,
  `Opinion_vereda_idOpinion_vereda` INT NOT NULL,
  `puntaje` INT NOT NULL,
  PRIMARY KEY (`Usuario_idUsuario`, `puntaje`, `Opinion_vereda_idOpinion_vereda`),
  INDEX `fk_Usuario_has_Opinion_vereda_Opinion_vereda1_idx` (`Opinion_vereda_idOpinion_vereda` ASC) VISIBLE,
  INDEX `fk_Usuario_has_Opinion_vereda_Usuario1_idx` (`Usuario_idUsuario` ASC) VISIBLE,
  CONSTRAINT `fk_Usuario_has_Opinion_vereda_Opinion_vereda1`
    FOREIGN KEY (`Opinion_vereda_idOpinion_vereda`)
    REFERENCES `mapa`.`opinion_vereda` (`idOpinion_vereda`),
  CONSTRAINT `fk_Usuario_has_Opinion_vereda_Usuario1`
    FOREIGN KEY (`Usuario_idUsuario`)
    REFERENCES `mapa`.`usuario` (`idUsuario`))
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
