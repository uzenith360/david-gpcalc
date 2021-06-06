import { AfterViewInit, Component, OnInit, ViewChild } from '@angular/core';
import { MatPaginator } from '@angular/material/paginator';
import { MatSort } from '@angular/material/sort';
import { MatTableDataSource } from '@angular/material/table';
import { FormControl, Validators } from '@angular/forms';
import XLSX from 'xlsx';
import Cgpa from './cgpa';
import { SheetRow } from './sheet-row';
import { CgpaResult } from './cgpa-result';
import { SheetResult } from './sheet-result';

type cgpaToks = { totalScore: number, totalUnits: number };
type cgpaRow = { [matricNumber: string]: cgpaToks };

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.css']
})
export class MainComponent implements OnInit, AfterViewInit {
  public displayedColumns: string[] = ['id', 'matric_number', 'total_score', 'total_units', 'cgpa'];
  public dataSource: MatTableDataSource<CgpaResult>;
  public courses!: string[];

  @ViewChild(MatPaginator) paginator!: MatPaginator;
  @ViewChild(MatSort) sort!: MatSort;

  public coursesFormControl: FormControl = new FormControl('', [
    Validators.required,
  ]);
  public formMessage: string = 'Please upload the courses results';

  constructor() {
    this.dataSource = new MatTableDataSource();
  }

  ngAfterViewInit() {
    this.dataSource.paginator = this.paginator;
    this.dataSource.sort = this.sort;
  }

  applyFilter(event: Event) {
    const filterValue = (event.target as HTMLInputElement).value;
    this.dataSource.filter = filterValue.trim().toLowerCase();

    if (this.dataSource.paginator) {
      this.dataSource.paginator.firstPage();
    }
  }

  ngOnInit(): void { }

  public async handleFilesUpload(e: any): Promise<void> {
    const files = e.target.files;
    const cgpas: cgpaRow = {};

    this.courses = [];
    this.formMessage = '';

    for (const file of files) {
      await new Promise((resolve, reject) => {
        const fileReader = new FileReader();

        fileReader.onload = (event: ProgressEvent<FileReader>) => {
          const data = event.target?.result;
          const workbook = XLSX.read(data, { type: "binary" });

          workbook.SheetNames.forEach((sheet) => {
            const rowObject: any[] = XLSX.utils.sheet_to_json(workbook.Sheets[sheet]);

            for (const item of rowObject) {
              const row = <SheetRow>{
                'MATRIC NO': String(item['MATRIC NO']).trim(),
                UNIT: +item.UNIT,
                //@ts-ignore
                GRADE: +Cgpa[String(item.GRADE).toUpperCase().trim()],
              };
              const matricNumber: string = row['MATRIC NO'];

              if (!cgpas[matricNumber]) {
                cgpas[row['MATRIC NO']] = { totalScore: 0, totalUnits: 0 };
              }

              cgpas[matricNumber].totalScore += (row.GRADE * row.UNIT);
              cgpas[matricNumber].totalUnits += row.UNIT;
            }

            this.courses.push(`${file.name} - ${sheet}`);
          });

          resolve(null);
        }

        fileReader.readAsBinaryString(file);
      });
    }

    let idCount: number = 0;
    const cgpaResults: CgpaResult[] = [];

    for (const matricNumber in cgpas) {
      if (cgpas.hasOwnProperty(matricNumber)) {
        const cgpa: cgpaToks = cgpas[matricNumber];

        cgpaResults.push({
          matric_number: matricNumber,
          id: idCount += 1,
          cgpa: Number(cgpa.totalScore / cgpa.totalUnits).toPrecision(2),
          total_score: cgpa.totalScore,
          total_units: cgpa.totalUnits,
        });
      }
    }

    this.dataSource.data = cgpaResults;
  }

  public downloadResults(): void {
    const data: SheetResult[] = this.dataSource.data.map(
      (datum: CgpaResult) => (<SheetResult>{
        ID: datum.id,
        "Matric Number": datum.matric_number,
        "Total Score": datum.total_score,
        "Total Units": datum.total_units,
        CGPA: datum.cgpa,
      }),
    );
    const sheet = XLSX.utils.json_to_sheet(
      data,
      {
        header: ['ID', 'Matric Number', 'Total Score', 'Total Units', 'CGPA']
      }
    );
    const wb: XLSX.WorkBook = XLSX.utils.book_new();

    wb.Sheets = {
      Results: sheet,
    }
    wb.SheetNames = ['Results'];

    XLSX.writeFile(wb, 'results.xlsx')
  }
}
