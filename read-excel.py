import pandas as pd
import sys

try:
    df = pd.read_excel('Listado_de_Ramos_Activos.xlsx')
    
    # Columna 1: ID
    # Columna 2: Global Ramo Name
    # Columna 3: Specific Ramo Name
    # Queremos agrupar por Global Ramo Name y ver qué ID tiene
    
    # Asumamos que las columnas no tienen nombre (o lo tienen). Vamos a usar índices
    unique_ramos = df.iloc[:, [0, 1]].drop_duplicates()
    for index, row in unique_ramos.iterrows():
        print(f"ID: {row.iloc[0]} - Nombre Global: {row.iloc[1]}")
        
except Exception as e:
    print("Error reading Excel file:", e)
